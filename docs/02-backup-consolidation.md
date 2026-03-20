# 02 - Backup Consolidation: Unified Encrypted Archive → Backy

## Overview

Consolidate four overlapping backup subsystems into one unified flow:

**Encrypted archive** (AES-GCM + ZIP) → **Push to Backy** (webhook) → **Restore from file** (decrypt + unzip + import)

Remove: D1 `backups` table storage, Worker cron backup, Settings encryption indicator (read-only), manual backup list UI. Keep: Import/Export dialogs (multi-format), encryption model, all test coverage.

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
                  │   or Cron triggers   │
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
          │  (webhook)   │    │  (browser)       │
          └──────────────┘    └──────────────────┘

                  ── RESTORE ──

          ┌──────────────────────────┐
          │  Upload ZIP + password   │  (Backup page)
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │  openEncryptedZip()      │  models/backup-archive.ts
          │  validate manifest       │
          │  AES-GCM decrypt         │
          │  deserializeBackup()     │
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │  batchImportSecrets()    │  actions/secrets.ts (existing)
          └──────────────────────────┘
```

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
| Backup actions | `actions/backup.ts` | **Rewrite** — replace D1 CRUD with archive + Backy push |
| Backup view | `components/backup-view.tsx` | **Rewrite** — new UI: create/download/push/restore |
| Backup viewmodel | `viewmodels/useBackupViewModel.ts` | **Rewrite** — new state management for archive flow |
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
| 1.1 | `feat: add backup archive model with encrypt/decrypt zip` | New `models/backup-archive.ts`: `createEncryptedZip()`, `openEncryptedZip()`, `validateManifest()`. Uses existing `models/encryption.ts`. Pure functions, no side effects. | `models/backup-archive.ts` (new) |
| 1.2 | `test: add backup archive round-trip tests` | Comprehensive tests: create → open round-trip, wrong password rejection, tampered manifest detection, v2 format validation, empty secrets edge case. | `tests/unit/models/backup-archive.test.ts` (new) |
| 1.3 | `feat: add backy integration model` | New `models/backy.ts`: types (`BackyConfig`, `BackyPushDetail`, `BackyHistoryResponse`), validation (`validateBackyConfig`, `isValidWebhookUrl`), helpers (`maskApiKey`, `buildBackyTag`, `formatFileSize`, `formatTimeAgo`, `getBackyEnvironment`). Ported from `../zhe/models/backy.ts`. | `models/backy.ts` (new) |
| 1.4 | `test: add backy model tests` | Unit tests for all pure functions in backy model. | `tests/unit/models/backy.test.ts` (new) |

### Phase 2: Server Actions

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 2.1 | `feat: add backy server actions` | New `actions/backy.ts`: `saveBackyConfig()`, `getBackyConfig()`, `testBackyConnection()`, `fetchBackyHistory()`, `pushBackup()`, `generatePullWebhookKey()`, `revokePullWebhookKey()`. References: `../zhe/actions/backy.ts`. | `actions/backy.ts` (new) |
| 2.2 | `feat: add backy pull webhook API route` | New `app/api/backy/pull/route.ts`: POST (Backy calls us → triggers push) + HEAD (connection test). References: `../zhe/app/api/backy/pull/route.ts`. | `app/api/backy/pull/route.ts` (new) |
| 2.3 | `refactor: rewrite backup actions for archive flow` | Rewrite `actions/backup.ts`: remove `createManualBackup`, `getBackups`, `getLatestBackup`, `getBackupCount`, `cleanupBackups`. Add `createBackupArchive(encryptionKey)` → returns encrypted ZIP blob, `restoreFromArchive(zipBlob, encryptionKey)` → decrypts + imports. | `actions/backup.ts` |
| 2.4 | `test: update backup action tests for archive flow` | Rewrite `tests/unit/actions/backup.test.ts` for the new action signatures. | `tests/unit/actions/backup.test.ts` |

### Phase 3: Database Schema

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 3.1 | `feat: add backy config columns to user_settings` | Add `backy_webhook_url`, `backy_api_key`, `backy_pull_key` to `user_settings` table. Add D1 migration SQL. Add ScopedDB methods: `getBackySettings()`, `upsertBackySettings()`, `getBackyPullWebhook()`, `upsertBackyPullWebhook()`, `deleteBackyPullWebhook()`. | `lib/db/scoped.ts`, `migrations/` (new migration) |
| 3.2 | `chore: add D1 migration to drop backups table` | Migration SQL to drop `backups` table. **Deploy note**: must run after all backup data has been exported or is no longer needed. | `migrations/` (new migration) |

### Phase 4: UI — Settings Page

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 4.1 | `feat: add encryption key management to settings` | Replace the read-only "Automated Backup Encryption" indicator with a key management section: generate key, reveal/copy key, save key. Uses `generateEncryptionKey()` from `models/encryption.ts`. | `components/settings-view.tsx`, `viewmodels/useSettingsViewModel.ts` |
| 4.2 | `feat: add backy config section to settings` | New section in Settings page: webhook URL, API key, test connection, pull webhook key generation. References: `../zhe` Backy settings UI pattern. | `components/settings-view.tsx`, `viewmodels/useSettingsViewModel.ts` |
| 4.3 | `test: update settings view tests` | Update tests for new encryption key management and Backy config sections. | `tests/unit/components/settings-view.test.tsx` |

### Phase 5: UI — Backup Page

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 5.1 | `refactor: rewrite backup page for archive flow` | Replace the backup list UI with: (1) "Create Backup" → generates encrypted ZIP, (2) "Download" → saves ZIP locally, (3) "Push to Backy" → sends to webhook, (4) "Restore" → upload ZIP + enter encryption key → decrypt + import. Remove: backup list, cleanup button. | `components/backup-view.tsx`, `viewmodels/useBackupViewModel.ts` |
| 5.2 | `test: update backup view tests` | Rewrite `tests/unit/components/backup-view.test.tsx` for the new UI. | `tests/unit/components/backup-view.test.tsx` |

### Phase 6: Cleanup

| # | Commit | Description | Files Changed |
|---|--------|-------------|---------------|
| 6.1 | `refactor: remove worker cron backup` | Delete `worker/src/backup.ts`, `worker/src/utils/crypto.ts`. Remove `scheduled()` handler from `worker/src/index.ts`. Remove backup-related constants from `worker/src/constants.ts`. | `worker/src/backup.ts` (delete), `worker/src/utils/crypto.ts` (delete), `worker/src/index.ts`, `worker/src/constants.ts` |
| 6.2 | `refactor: clean up dead code in backup model` | Remove unused functions from `models/backup.ts`: `shouldDebounceBackup`, `getBackupsToDelete`, `hasDataChanged`, `computeBackupHash` (replaced by SHA-256). Remove unused constants: `BACKUP_MAX_COUNT`, `BACKUP_DEBOUNCE_MS`, `BACKUP_CRON_SCHEDULE`. | `models/backup.ts`, `models/constants.ts` |
| 6.3 | `refactor: remove inline hash from backup actions` | Remove the duplicated `hashString()` FNV-1a implementation from `actions/backup.ts` (if any remnant). | `actions/backup.ts` |
| 6.4 | `test: remove stale backup e2e tests` | Update or remove `tests/api/backup.e2e.test.ts` that tested the old D1 backup CRUD API. | `tests/api/backup.e2e.test.ts` |
| 6.5 | `chore: update sidebar nav if needed` | Verify sidebar navigation still correct after backup page redesign. No-op if already correct. | — |

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

### 5.2 Unit Tests (actions)

| Test File | Covers | Key Assertions |
|-----------|--------|----------------|
| `tests/unit/actions/backup.test.ts` (rewrite) | `createBackupArchive`, `restoreFromArchive` | Mocked ScopedDB → assert archive blob is valid ZIP |
| | | Restore with correct key → secrets inserted |
| | | Restore with wrong key → error returned |
| `tests/unit/actions/backy.test.ts` (**new**) | `pushBackup`, `testBackyConnection`, `fetchBackyHistory` | Mocked fetch → assert FormData fields (file, environment, tag) |
| | | Auth header present |
| | | Error handling for network failure, 401, 403, 413 |

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

1. **Inform users** — If this is a multi-user deployment, notify that D1 backup history will be removed
2. **Optional: export existing D1 backups** — Provide a one-time migration script to download existing D1 backups as files before dropping the table

### 6.2 Deployment Sequence

```
Phase 1-2  ──►  Deploy  ──►  Phase 3.1  ──►  Deploy  ──►  Phase 4-5  ──►  Deploy
(new code,      (safe,        (add columns,   (safe,        (new UI)        (users see
 no UI change)  additive)     no breaking)    additive)                     new backup
                                                                            page)

──►  Phase 6.1-6.4  ──►  Deploy  ──►  Phase 3.2  ──►  Deploy
     (cleanup,            (worker         (drop            (final
      remove worker)      simplified)      backups table)   cleanup)
```

| Step | What | Risk | Rollback |
|------|------|------|----------|
| Deploy 1 | Phases 1-2: new models + actions (additive only) | None — no existing code modified yet | Revert commit |
| Deploy 2 | Phase 3.1: add DB columns | None — additive migration | Columns unused if reverted |
| Deploy 3 | Phases 4-5: new UI | Medium — users see new backup experience | Revert to previous UI commits |
| Deploy 4 | Phase 6.1-6.4: remove Worker cron, dead code | Low — old code removed but new flow already active | Re-add worker code from git |
| Deploy 5 | Phase 3.2: drop `backups` table | **Irreversible** — data deleted | Must export D1 backups before this step |

### 6.3 Post-deployment Verification

1. **Create backup** — Click "Create Backup" → encrypted ZIP downloads
2. **Verify archive** — Unzip contains `manifest.json` + `backup.json.enc`
3. **Restore** — Upload the ZIP + enter encryption key → secrets restored
4. **Push to Backy** — Configure webhook URL + API key → push succeeds → verify in Backy dashboard
5. **Pull from Backy** — Configure pull webhook → trigger from Backy → backup auto-pushed
6. **Import/Export** — Verify multi-format import/export still works unchanged

### 6.4 Backy Configuration

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
