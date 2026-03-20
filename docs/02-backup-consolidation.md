# 02 - Backup Consolidation: Unified Encrypted Archive → Backy

## Overview

Consolidate four overlapping backup subsystems into one unified flow:

**Encrypted archive** (AES-GCM + ZIP) → **Push to Backy** (webhook) → **Restore from file** (decrypt + unzip + import)

Remove: D1 `backups` table storage (with migration path), Worker cron backup, Settings encryption indicator (read-only), manual backup list UI. Keep: Import/Export dialogs (multi-format), encryption model, all test coverage.

### Constraints & Invariants

1. **No data loss** — Existing D1 backups must be exportable to the new ZIP format before dropping the `backups` table. A one-time migration commit is mandatory.
2. **React serialization boundary** — Server Actions (React 19 `use server`) cannot return `Blob`. File downloads and archive creation must use Route Handlers (`app/api/...`) that return `Response` with binary streams. Server Actions handle metadata-only returns.
3. **Dashboard data chain** — `getDashboardData()` (in `actions/dashboard.ts`) currently reads `backupCount`, `lastBackupAt`, and `encryptionEnabled` from the `backups` table and `user_settings.encryption_key_hash`. These feed into `DashboardProvider` → `DashboardState` → consumed by backup view, settings view. All links in this chain must be updated atomically.

---

## 1. Current State Analysis

### 1.1 Four Overlapping Subsystems

| # | Subsystem | Trigger | Output | Encrypted | Storage | Files |
|---|-----------|---------|--------|-----------|---------|-------|
| 1 | **Manual Backup** (Backup Page) | User click | JSON blob → D1 `backups` table | ❌ Never | D1 | `actions/backup.ts`, `components/backup-view.tsx`, `viewmodels/useBackupViewModel.ts` |
| 2 | **Cron Backup** (CF Worker) | Daily UTC 16:00 | JSON → D1 `backups` table | ✅ Optional (env var) | D1 | `worker/src/backup.ts`, `worker/src/utils/crypto.ts` |
| 3 | **Import/Export** (Dialogs) | User click | Multi-format JSON/CSV → clipboard/download | ❌ | None (ephemeral) | `models/import-parsers.ts`, `models/export-formatters.ts`, `components/import-dialog.tsx`, `components/export-dialog.tsx` |
| 4 | **Settings Encryption** | Read-only indicator | N/A | N/A | N/A | `components/settings-view.tsx` (encryption section) |

### 1.2 Key Problems

1. **Hash inconsistency** — Manual backup uses FNV-1a on raw JSON string (`actions/backup.ts:hashString`), Worker uses SHA-256 on normalized fields (`worker/src/backup.ts:computeSecretsHash`). Same `backups.hash` column, different semantics.
2. **Dead code** — `models/backup.ts` has `serializeBackup()`, `shouldDebounceBackup()`, `hasDataChanged()`, `getBackupsToDelete()` that are never called.
3. **Dual encryption implementations** — `models/encryption.ts` (Next.js side, unused by backup) and `worker/src/utils/crypto.ts` (Worker side, used by cron). Same `v1:` format, independent code.
4. **Manual backup never encrypts** — `createManualBackup()` hardcodes `encrypted: false`.
5. **Encrypted backups cannot be restored via UI** — `restoreBackup()` explicitly rejects encrypted data.
6. **D1 as backup store is fragile** — Backups stored in the same database they're supposed to protect. No off-site redundancy.

---

## 2. Target Architecture

### 2.1 Design Principles

- **One backup format**: Encrypted ZIP containing a well-defined JSON payload
- **One outbound path**: Push to Backy via webhook (multipart/form-data)
- **One inbound path**: Upload encrypted ZIP → decrypt → unzip → restore
- **Encryption key lives in app**: Stored in `user_settings`, visible on Settings page. This is the only secret needed to decrypt a backup.
- **Import/Export stays separate**: Multi-format import (16 parsers) and export (12 formatters) remain as-is for interoperability with other TOTP apps. They serve a different purpose (app migration) than backup (disaster recovery).

### 2.2 New Flow

```
                  ┌──────────────────────┐
                  │   User clicks        │
                  │   "Create Backup"    │
                  │   or Backy pull      │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  serializeBackup()   │  models/backup.ts
                  │  → BackupData JSON   │  { version: 2, secrets, meta }
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  createEncryptedZip()│  models/backup-archive.ts (NEW)
                  │  AES-GCM encrypt     │
                  │  → ZIP containing:   │
                  │    backup.json.enc   │
                  │    manifest.json     │
                  └──────────┬───────────┘
                             │
                   ┌─────────┴──────────┐
                   │                    │
                   ▼                    ▼
          ┌──────────────┐    ┌──────────────────┐
          │  Push to     │    │  Download to     │
          │  Backy       │    │  local file      │
          │  (server     │    │  (route handler  │
          │   action)    │    │   → binary resp) │
          └──────────────┘    └──────────────────┘

                  ── RESTORE ──

          ┌──────────────────────────┐
          │  Upload ZIP + password   │  (Backup page)
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │  POST /api/backup/       │  Route Handler
          │  restore                 │  (accepts multipart: zip + key)
          │  → openEncryptedZip()    │  models/backup-archive.ts
          │  → deserializeBackup()   │
          │  → batchImportSecrets()  │
          └──────────────────────────┘
```

### 2.2.1 Server Action vs Route Handler Boundary

React 19 Server Functions (`'use server'`) can return JSON-serializable values only. `Blob`, `File`, `ReadableStream` are **not** serializable across the RSC wire format. Reference: https://react.dev/reference/rsc/use-server

Therefore:

| Operation | Mechanism | Why |
|-----------|-----------|-----|
| **Create + download archive** | `GET /api/backup/archive` (Route Handler) | Returns `Response` with `Content-Type: application/zip`, binary body. Client triggers download via `<a href>` or `window.open`. |
| **Create + push to Backy** | Server Action `pushBackupToBacky()` | Server-side only — creates ZIP in memory, POSTs to Backy webhook, returns JSON result `{ success, tag, durationMs }`. No binary crosses the serialization boundary. |
| **Restore from archive** | `POST /api/backup/restore` (Route Handler) | Accepts `multipart/form-data` (zip file + encryption key string). Returns JSON `{ success, importedCount }`. |
| **Config CRUD (Backy settings)** | Server Actions | Pure JSON in/out — fits the model. |

### 2.3 Archive Format

```
neo-backup-2026-03-20.zip
├── manifest.json          ← plaintext metadata
│   {
│     "version": 2,
│     "format": "neo-encrypted-backup",
│     "createdAt": "2026-03-20T10:30:00Z",
│     "secretCount": 12,
│     "encryption": {
│       "algorithm": "AES-GCM-256",
│       "ivEncoding": "base64",
│       "tagLength": 128
│     }
│   }
│
└── backup.json.enc        ← AES-GCM encrypted payload
    v1:<iv_base64>:<ciphertext_base64>
    (decrypted content = BackupData JSON)
```

**BackupData JSON** (inside encrypted file, version bumped to 2):

```json
{
  "version": 2,
  "createdAt": "2026-03-20T10:30:00Z",
  "secretCount": 12,
  "hash": "<sha256-hex>",
  "secrets": [
    {
      "name": "GitHub",
      "account": "user@example.com",
      "secret": "JBSWY3DPEHPK3PXP",
      "type": "totp",
      "digits": 6,
      "period": 30,
      "algorithm": "SHA1",
      "counter": 0
    }
  ]
}
```

### 2.4 Backy Integration

Reference implementation: `../zhe/actions/backy.ts` (pushBackup pattern)

| Concept | Zhe | Neo (new) |
|---------|-----|-----------|
| Payload | Plain JSON blob | Encrypted ZIP file |
| Content-Type | `application/json` | `application/zip` |
| File naming | `zhe-backup-YYYY-MM-DD.json` | `neo-backup-YYYY-MM-DD.zip` |
| Tag format | `v{ver}-{date}-{N}lnk-{N}fld-{N}tag` | `v{ver}-{date}-{N}secrets` |
| Push endpoint | `POST /api/webhook/{projectId}` | Same (Backy API) |
| Auth | `Authorization: Bearer {token}` | Same |
| Pull webhook | `POST /api/backy/pull` | Same pattern |

### 2.5 Encryption Key Management

- **Generation**: `generateEncryptionKey()` from existing `models/encryption.ts` (256-bit random → base64)
- **Storage**: `user_settings.encryption_key_hash` → change to `user_settings.encryption_key` (base64 string, persisted in D1)
- **Display**: Settings page shows the key (masked by default, reveal on click) with copy button
- **Usage**: Same key for both creating and restoring backups. User must save this key externally — if lost, encrypted backups cannot be restored.

---

## 3. Reference Projects & Files

### 3.1 Current Project (neo)

| Area | Files | Disposition |
|------|-------|-------------|
| Backup model | `models/backup.ts` | **Rewrite** — keep `deserializeBackup` (add v2 support), remove dead code |
| Backup archive (NEW) | `models/backup-archive.ts` | **New** — `createEncryptedZip()`, `openEncryptedZip()`, `validateManifest()` |
| Backup actions | `actions/backup.ts` | **Rewrite** — replace D1 CRUD with `pushBackupToBacky()` (server action, JSON return) |
| Backup route: download | `app/api/backup/archive/route.ts` | **New** — `GET` returns encrypted ZIP as binary `Response` |
| Backup route: restore | `app/api/backup/restore/route.ts` | **New** — `POST` accepts multipart (zip + key), returns JSON result |
| Backup view | `components/backup-view.tsx` | **Rewrite** — new UI: create/download/push/restore |
| Backup viewmodel | `viewmodels/useBackupViewModel.ts` | **Rewrite** — new state management for archive flow |
| Dashboard action | `actions/dashboard.ts` | **Edit** — remove `backupCount` / `lastBackupAt` from `getDashboardData()`, update `encryptionEnabled` to read from new `encryption_key` column |
| Dashboard context | `contexts/dashboard-context.tsx` | **Edit** — remove `backupCount` / `lastBackupAt` / `handleBackupCreated` from state and actions, update `encryptionEnabled` source |
| Dashboard types | `models/types.ts` | **Edit** — remove `backupCount` / `lastBackupAt` from `DashboardData`, keep `encryptionEnabled` |
| Worker cron backup | `worker/src/backup.ts` | **Delete** — replaced by Backy push (manual or cron from Backy side) |
| Worker crypto | `worker/src/utils/crypto.ts` | **Delete** — unified into `models/encryption.ts` |
| Worker index | `worker/src/index.ts` | **Edit** — remove `scheduled()` handler and backup import |
| Encryption model | `models/encryption.ts` | **Keep** — becomes the single encryption implementation |
| Import parsers | `models/import-parsers.ts` | **Keep** — unchanged |
| Export formatters | `models/export-formatters.ts` | **Keep** — unchanged |
| Import dialog | `components/import-dialog.tsx` | **Keep** — unchanged |
| Export dialog | `components/export-dialog.tsx` | **Keep** — unchanged |
| Settings view | `components/settings-view.tsx` | **Edit** — replace encryption indicator with key management UI |
| Settings viewmodel | `viewmodels/useSettingsViewModel.ts` | **Edit** — add key management actions |
| Settings action | `actions/settings.ts` | **Edit** — add encryption key CRUD (read actual key, not just hash) |
| ScopedDB | `lib/db/scoped.ts` | **Edit** — remove backup CRUD methods, add backy settings methods, update encryption key column |
| Constants | `models/constants.ts` | **Edit** — remove `BACKUP_MAX_COUNT`, `BACKUP_DEBOUNCE_MS`, `BACKUP_CRON_SCHEDULE` |

### 3.2 Backy (../backy)

| What to Reference | File | Why |
|-------------------|------|-----|
| Webhook API contract | `src/app/api/webhook/[projectId]/route.ts` | POST endpoint: multipart/form-data, file + environment + tag fields |
| Restore API contract | `src/app/api/restore/[id]/route.ts` | GET endpoint: returns presigned R2 URL |
| File type detection | `src/lib/backup/file-type.ts` | Backy auto-detects json/zip/gz — our ZIP will be recognized |
| Auth pattern | `src/app/api/webhook/[projectId]/route.ts` | `Authorization: Bearer {token}`, 48-char nanoid |

### 3.3 Zhe (../zhe)

| What to Reference | File | Why |
|-------------------|------|-----|
| Backy model (types + validation) | `models/backy.ts` | Reuse `BackyConfig`, `validateBackyConfig`, `maskApiKey`, `formatFileSize`, `formatTimeAgo` |
| Push implementation | `actions/backy.ts:pushBackup()` | FormData construction, inline history fetch, error handling |
| Pull webhook handler | `app/api/backy/pull/route.ts` | Pull webhook pattern for Backy-triggered backups |
| Config storage | `lib/db/scoped.ts` | `backy_webhook_url`, `backy_api_key`, `backy_pull_key` columns in user_settings |

---

## 4. Atomic Commits Plan

### Phase 1: Foundation (no behavioral change)

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 1.1 | `feat: add backup archive model with encrypt/decrypt zip` | New `models/backup-archive.ts`: `createEncryptedZip(secrets, key) → Uint8Array`, `openEncryptedZip(zipBytes, key) → ParsedSecret[]`, `validateManifest()`. Operates on `Uint8Array` (not Blob) for universal compatibility. Uses existing `models/encryption.ts`. Pure functions, no side effects. | `models/backup-archive.ts` (new) |
| 1.2 | `test: add backup archive round-trip tests` | Comprehensive tests: create → open round-trip, wrong password rejection, tampered manifest detection, v2 format validation, empty secrets edge case. | `tests/unit/models/backup-archive.test.ts` (new) |
| 1.3 | `feat: add backy integration model` | New `models/backy.ts`: types (`BackyConfig`, `BackyPushDetail`, `BackyHistoryResponse`), validation (`validateBackyConfig`, `isValidWebhookUrl`), helpers (`maskApiKey`, `buildBackyTag`, `formatFileSize`, `formatTimeAgo`, `getBackyEnvironment`). Ported from `../zhe/models/backy.ts`. | `models/backy.ts` (new) |
| 1.4 | `test: add backy model tests` | Unit tests for all pure functions in backy model. | `tests/unit/models/backy.test.ts` (new) |

### Phase 2: Route Handlers + Server Actions

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 2.1 | `feat: add backup archive download route handler` | New `app/api/backup/archive/route.ts`: authenticated `GET` → queries secrets from ScopedDB, reads encryption key from `user_settings`, calls `createEncryptedZip()`, returns `new Response(zipBytes, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename=...' } })`. **This is a Route Handler, not a Server Action**, because binary `Response` cannot cross the RSC serialization boundary. | `app/api/backup/archive/route.ts` (new) |
| 2.2 | `feat: add backup restore route handler` | New `app/api/backup/restore/route.ts`: authenticated `POST` accepting `multipart/form-data` with fields `file` (ZIP) and `encryptionKey` (string). Calls `openEncryptedZip()` → `batchImportSecrets()`. Returns JSON `{ success, importedCount }`. | `app/api/backup/restore/route.ts` (new) |
| 2.3 | `feat: add backy push server action` | New `actions/backy.ts`: `pushBackupToBacky()` — server-side only. Creates ZIP in memory (`createEncryptedZip()`), constructs `FormData` with the ZIP as `Blob`, POSTs to configured Backy webhook URL. Returns `{ success, tag, durationMs }` (JSON only, no binary). Also: `saveBackyConfig()`, `getBackyConfig()`, `testBackyConnection()`, `fetchBackyHistory()`, pull webhook key CRUD. References: `../zhe/actions/backy.ts`. | `actions/backy.ts` (new) |
| 2.4 | `feat: add backy pull webhook API route` | New `app/api/backy/pull/route.ts`: POST (Backy calls us → triggers `pushBackupToBacky()`) + HEAD (connection test). Authenticated via `X-Webhook-Key` header. References: `../zhe/app/api/backy/pull/route.ts`. | `app/api/backy/pull/route.ts` (new) |
| 2.5 | `test: add backy action and route tests` | Tests for push action (mocked fetch → assert FormData fields), route handler tests. | `tests/unit/actions/backy.test.ts` (new) |

### Phase 3: Database Schema + Dashboard Chain

This phase must be done **atomically** — the column changes, ScopedDB methods, dashboard action, dashboard context, and types must all land in the same deploy to avoid runtime breakage.

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 3.1 | `feat: add backy config columns and encryption_key to user_settings` | D1 migration: `ALTER TABLE user_settings ADD COLUMN backy_webhook_url TEXT`, `...backy_api_key TEXT`, `...backy_pull_key TEXT`, `...encryption_key TEXT`. Add ScopedDB methods: `getBackySettings()`, `upsertBackySettings()`, `getBackyPullWebhook()`, `upsertBackyPullWebhook()`, `deleteBackyPullWebhook()`, `getEncryptionKey()`, `setEncryptionKey()`. | `lib/db/scoped.ts`, `migrations/` (new) |
| 3.2 | `refactor: update dashboard data chain for backup removal` | **Critical: this commit updates the full data chain atomically.** (1) `actions/dashboard.ts`: remove `db.getBackupCount()` and `db.getLatestBackup()` from `getDashboardData()`, change `encryptionEnabled` to read from `db.getEncryptionKey() !== null` instead of `settings.encryptionKeyHash`. (2) `models/types.ts`: remove `backupCount` and `lastBackupAt` from `DashboardData`. (3) `contexts/dashboard-context.tsx`: remove `backupCount`, `lastBackupAt`, `handleBackupCreated` from `DashboardState` and `DashboardActions`. (4) Update all consumers that reference these removed fields. | `actions/dashboard.ts`, `models/types.ts`, `contexts/dashboard-context.tsx`, `viewmodels/useBackupViewModel.ts`, `components/backup-view.tsx` |
| 3.3 | `test: update dashboard and context tests for removed backup fields` | Update `tests/unit/actions/dashboard.test.ts`, `tests/unit/contexts/dashboard-context.test.tsx` (if exists), and any component tests that mock `useDashboardState` with `backupCount`/`lastBackupAt`. | `tests/unit/actions/dashboard.test.ts`, etc. |

### Phase 4: Migration — Export Existing D1 Backups

**This phase provides the migration path before any data deletion.**

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 4.1 | `feat: add one-time D1 backup export route` | New `app/api/backup/migrate/route.ts`: authenticated `GET` → reads all rows from `backups` table for current user, converts each to the new encrypted ZIP format (using the user's encryption key), bundles them into a single TAR or returns them as individual downloads. If no encryption key is configured yet, auto-generates one and stores it. This is a **temporary** route, removed in Phase 7. | `app/api/backup/migrate/route.ts` (new) |
| 4.2 | `feat: add migration notice to backup page` | Show a banner on the backup page: "You have N existing backups in the old format. [Export All] to download them as encrypted archives before migration." Links to the migration route. | `components/backup-view.tsx` |

### Phase 5: UI — Settings Page

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 5.1 | `feat: add encryption key management to settings` | Replace the read-only "Automated Backup Encryption" indicator with a key management section: generate key, reveal/copy key, save key. Uses `generateEncryptionKey()` from `models/encryption.ts`. The key value is read via `getEncryptionKey()` from ScopedDB and displayed masked (click to reveal + copy button). **Warning text**: "Save this key externally. If lost, encrypted backups cannot be restored." | `components/settings-view.tsx`, `viewmodels/useSettingsViewModel.ts`, `actions/settings.ts` |
| 5.2 | `feat: add backy config section to settings` | New section in Settings page: webhook URL input, API key input (masked), test connection button, pull webhook key generation/revocation. References: `../zhe` Backy settings UI pattern. | `components/settings-view.tsx`, `viewmodels/useSettingsViewModel.ts` |
| 5.3 | `test: update settings view tests` | Update tests for new encryption key management and Backy config sections. | `tests/unit/components/settings-view.test.tsx`, `tests/unit/viewmodels/useSettingsViewModel.test.ts` |

### Phase 6: UI — Backup Page

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 6.1 | `refactor: rewrite backup page for archive flow` | Replace the backup list UI with: (1) "Create & Download" → `GET /api/backup/archive` triggers browser download of encrypted ZIP, (2) "Push to Backy" → calls `pushBackupToBacky()` server action, shows result, (3) "Restore" → upload ZIP file + enter encryption key → `POST /api/backup/restore`. Remove: backup list, cleanup button, `backupCount`/`lastBackupAt` display. | `components/backup-view.tsx`, `viewmodels/useBackupViewModel.ts` |
| 6.2 | `refactor: rewrite backup actions (remove D1 CRUD)` | Remove old backup server actions: `createManualBackup`, `getBackups`, `getLatestBackup`, `getBackupCount`, `cleanupBackups`, `restoreBackup`. Keep `actions/backup.ts` as a thin re-export or merge remaining logic into route handlers. | `actions/backup.ts` |
| 6.3 | `test: update backup view and action tests` | Rewrite `tests/unit/components/backup-view.test.tsx` and `tests/unit/actions/backup.test.ts` for the new flow. | `tests/unit/components/backup-view.test.tsx`, `tests/unit/actions/backup.test.ts` |

### Phase 7: Cleanup

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 7.1 | `refactor: remove worker cron backup` | Delete `worker/src/backup.ts`, `worker/src/utils/crypto.ts`. Remove `scheduled()` handler from `worker/src/index.ts`. Remove backup-related constants from `worker/src/constants.ts`. | `worker/src/backup.ts` (delete), `worker/src/utils/crypto.ts` (delete), `worker/src/index.ts`, `worker/src/constants.ts` |
| 7.2 | `refactor: clean up dead code in backup model` | Remove unused functions from `models/backup.ts`: `shouldDebounceBackup`, `getBackupsToDelete`, `hasDataChanged`, `computeBackupHash` (replaced by SHA-256). Remove unused constants: `BACKUP_MAX_COUNT`, `BACKUP_DEBOUNCE_MS`, `BACKUP_CRON_SCHEDULE`. | `models/backup.ts`, `models/constants.ts` |
| 7.3 | `refactor: remove ScopedDB backup methods` | Remove `getBackups()`, `getLatestBackup()`, `getBackupCount()`, `createBackup()`, `deleteOldBackups()` from `lib/db/scoped.ts`. These are now dead code since all callers were removed in Phase 6. | `lib/db/scoped.ts` |
| 7.4 | `test: remove stale backup e2e tests` | Update or remove `tests/api/backup.e2e.test.ts` that tested the old D1 backup CRUD API. | `tests/api/backup.e2e.test.ts` |
| 7.5 | `chore: remove migration route` | Delete `app/api/backup/migrate/route.ts` and migration banner from backup page. This was a one-time path, no longer needed after users have migrated. | `app/api/backup/migrate/route.ts` (delete), `components/backup-view.tsx` |
| 7.6 | `chore: D1 migration to drop backups table` | Migration SQL: `DROP TABLE IF EXISTS backups`. **Deploy gate**: only run after confirming all users have migrated their D1 backups (Phase 4 migration route was available for at least one release cycle). | `migrations/` (new) |

---

## 5. Test Plan

### 5.1 Unit Tests (models)

| Test File | Covers | Key Assertions |
|-----------|--------|----------------|
| `tests/unit/models/backup-archive.test.ts` (**new**) | `createEncryptedZip`, `openEncryptedZip` | Round-trip: create → open → assert secrets match original |
| | | Wrong key → throws decryption error |
| | | Tampered manifest → validation error |
| | | Missing `backup.json.enc` → format error |
| | | Empty secrets array → valid archive with 0 entries |
| | | Large payload (1000 secrets) → completes within timeout |
| `tests/unit/models/backup.test.ts` (update) | `serializeBackup` (v2), `deserializeBackup` (v1 + v2 compat) | v1 format still parseable (backward compat) |
| | | v2 format round-trip |
| `tests/unit/models/backy.test.ts` (**new**) | All pure functions | `validateBackyConfig` edge cases, `maskApiKey` lengths, `buildBackyTag` format, `formatFileSize` units, `formatTimeAgo` ranges |
| `tests/unit/models/encryption.test.ts` (existing, keep) | `encryptData`, `decryptData`, `isEncrypted`, `generateEncryptionKey` | Already 100% pass — no changes needed |
| `tests/unit/models/import-parsers.test.ts` (existing, keep) | 16 format parsers | Already passing — no changes |
| `tests/unit/models/export-formatters.test.ts` (existing, keep) | 12 format exporters | Already passing — no changes |

### 5.2 Unit Tests (actions + route handlers)

| Test File | Covers | Key Assertions |
|-----------|--------|----------------|
| `tests/unit/actions/backy.test.ts` (**new**) | `pushBackupToBacky`, `testBackyConnection`, `fetchBackyHistory` | Mocked fetch → assert FormData fields (file as Blob, environment, tag) |
| | | Auth header `Bearer {token}` present |
| | | Error handling for network failure, 401, 403, 413 |
| `tests/unit/actions/backup.test.ts` (rewrite) | Remaining backup logic (if any thin wrappers kept) | Validate delegation to archive model |
| `tests/api/backup-archive.e2e.test.ts` (**new**, or adapt existing) | `GET /api/backup/archive`, `POST /api/backup/restore` | Route handler: GET returns `Content-Type: application/zip` with valid ZIP body |
| | | Route handler: POST with valid ZIP + correct key → `{ success: true, importedCount: N }` |
| | | Route handler: POST with wrong key → `{ success: false, error: "..." }` |
| | | Route handler: POST without auth → 401 |

### 5.3 Unit Tests (components)

| Test File | Covers | Key Assertions |
|-----------|--------|----------------|
| `tests/unit/components/backup-view.test.tsx` (rewrite) | New backup page UI | Create/download/push/restore buttons render |
| | | Create triggers archive creation |
| | | Restore shows key input |
| `tests/unit/components/settings-view.test.tsx` (update) | Encryption key section, Backy config section | Key generation works |
| | | Backy URL validation |

### 5.4 Integration / E2E Tests

| Test File | Covers | Key Assertions |
|-----------|--------|----------------|
| `tests/api/backup.e2e.test.ts` (rewrite or remove) | End-to-end archive flow | If env has D1: create archive → restore → verify secrets match |
| | | If no D1: skip (test in CI only) |

### 5.5 Critical Round-Trip Test

This is the **most important test** — proves that a backup created by neo can be restored by neo:

```typescript
// tests/unit/models/backup-archive.test.ts
describe("round-trip: create → restore", () => {
  it("encrypts and decrypts secrets with correct key", async () => {
    const key = await generateEncryptionKey();
    const secrets: ParsedSecret[] = [
      { name: "GitHub", account: "user@github.com", secret: "JBSWY3DPEHPK3PXP", ... },
      { name: "Google", account: "user@gmail.com", secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ", ... },
    ];

    // Create
    const zipBlob = await createEncryptedZip(secrets, key);
    expect(zipBlob.size).toBeGreaterThan(0);

    // Restore
    const restored = await openEncryptedZip(zipBlob, key);
    expect(restored).toHaveLength(2);
    expect(restored[0].name).toBe("GitHub");
    expect(restored[0].secret).toBe("JBSWY3DPEHPK3PXP");
    expect(restored[1].name).toBe("Google");
  });

  it("rejects wrong decryption key", async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();
    const secrets = [{ name: "Test", secret: "ABC", ... }];

    const zipBlob = await createEncryptedZip(secrets, key1);

    await expect(openEncryptedZip(zipBlob, key2)).rejects.toThrow();
  });
});
```

---

## 6. Deployment Plan

### 6.1 Pre-deployment

1. **Set up Backy project** — Create a "neo" project in Backy dashboard, get webhook URL and API key ready
2. **Communicate** — If multi-user, notify that backup workflow is changing

### 6.2 Deployment Sequence

```
Phase 1-2  ──►  Deploy 1  ──►  Phase 3  ──►  Deploy 2
(new models,    (safe,          (DB schema +   (dashboard
 routes,         additive,      dashboard       updated,
 actions)        no UI change)  chain update)   additive)

──►  Phase 4  ──►  Deploy 3  ──►  Phase 5-6  ──►  Deploy 4
     (migration     (users can      (settings +     (new backup
      route +        export old      backup UI       experience
      banner)        D1 backups)     rewrite)        live)

──►  Phase 7.1-7.4  ──►  Deploy 5  ──►  Phase 7.5-7.6  ──►  Deploy 6
     (worker + dead      (cleanup)       (remove migration   (final,
      code removal)                       route, drop table)  irreversible)
```

| Step | What | Phases | Risk | Rollback |
|------|------|--------|------|----------|
| Deploy 1 | New models + route handlers + actions | 1-2 | None — all additive, no existing code changed | Revert commits |
| Deploy 2 | DB columns + dashboard chain update | 3 | Low — additive columns, dashboard shows less info (no backupCount) | Revert; columns are unused if reverted |
| Deploy 3 | Migration route + banner | 4 | None — old backup list still works, banner is informational | Revert commits |
| Deploy 4 | New Settings + Backup UI | 5-6 | Medium — users see completely new backup experience | Revert to pre-Phase 5 commits |
| Deploy 5 | Worker cleanup + dead code removal | 7.1-7.4 | Low — old code removed but new flow already active | Re-add from git |
| Deploy 6 | Remove migration route + drop `backups` table | 7.5-7.6 | **Irreversible** — D1 backup data deleted | Must confirm all users have migrated first |

### 6.3 Migration Gate for Deploy 6

**Do NOT run Phase 7.6 (DROP TABLE) until:**

1. Phase 4 migration route has been live for at least **one release cycle** (recommend 2 weeks minimum)
2. Server logs confirm the migration route was called (or no backups exist in D1)
3. Optionally: run a one-time query `SELECT user_id, COUNT(*) FROM backups GROUP BY user_id` to verify who still has data

### 6.4 Post-deployment Verification

1. **Create backup** — Click "Create & Download" → encrypted ZIP downloads
2. **Verify archive** — Unzip contains `manifest.json` + `backup.json.enc`
3. **Restore** — Upload the ZIP + enter encryption key → secrets restored with correct count
4. **Push to Backy** — Configure webhook URL + API key → push succeeds → verify in Backy dashboard
5. **Pull from Backy** — Configure pull webhook → trigger from Backy → backup auto-pushed
6. **Import/Export** — Verify multi-format import/export still works unchanged
7. **Dashboard** — Verify dashboard loads without error after `backupCount`/`lastBackupAt` removal

### 6.5 Backy Configuration

In Backy dashboard, create a new project for neo:

```
Project name: neo
Auto-backup: enabled (if using pull webhook)
Pull URL: https://<neo-host>/api/backy/pull
Pull header: X-Webhook-Key: <generated-pull-key>
```

---

## 7. Open Questions

1. **ZIP library choice** — Need a lightweight ZIP library that works in both Edge Runtime (Next.js server actions) and browser (for local download/restore). Candidates: `fflate` (8KB gzipped, no deps, works everywhere), `jszip` (larger, more features). **Recommendation: `fflate`** for minimal footprint.

2. **Encryption key persistence** — Currently `user_settings` stores `encryption_key_hash`. The new design needs the actual key (not hash) to encrypt/decrypt. Two options:
   - (a) Store the actual base64 key in D1 `user_settings.encryption_key` — simpler, but key is in D1
   - (b) Only store in browser (localStorage) — more secure, but lost on device switch
   - **Recommendation: (a)** — the key protects against off-site backup compromise, not against D1 compromise. If D1 is compromised, the raw secrets are already there.

3. **Worker cron replacement** — After removing Worker cron backup, periodic backups depend on Backy's auto-backup cron calling our pull webhook. This means:
   - Neo needs the pull webhook API route
   - Backy needs to be configured with neo's pull URL
   - If Backy is down, no periodic backups occur
   - **Alternative**: Keep a simplified Worker scheduled handler that calls `pushBackup()` directly, no D1 storage. Decide during implementation.

---

## 8. Dependencies

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `fflate` | ^0.8 | ZIP create/extract (recommended) | ~8KB gzipped |
| `@radix-ui/react-collapsible` | ^1.1 | Already installed (sidebar) | — |

No other new dependencies required. `models/encryption.ts` (AES-GCM) uses Web Crypto API natively.
