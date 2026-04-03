# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-04

First stable release. Full-featured 2FA authenticator with end-to-end encryption, PWA support, and comprehensive quality infrastructure.

### Added

- **Per-page loading skeletons** — all dashboard routes now show Basalt B-4 compliant skeleton UI during SSR loading

### Highlights (since 0.x series)

- **End-to-end encryption** — AES-GCM 256-bit encryption for all secrets
- **TOTP/HOTP support** — compatible with Google Authenticator, Authy, and other standard 2FA apps
- **PWA with offline support** — installable app with service worker and offline queue
- **Keyboard navigation** — full keyboard support with `⌘K` search and arrow key navigation
- **Import/Export** — support for Google Authenticator, Authy, and standard OTP URI formats
- **Backy integration** — encrypted cloud backup via Backy service
- **Six-dimension quality** — L1/L2/L3 + G1/G2 + D1 all passing (Tier S)

## [0.2.8] - 2026-04-04

Port migration and Basalt spec alignment.

### Changed

- **Port migration** — dev server ports migrated from 7042/17024/27042 to 7026/17026/27026 for consistency

### Fixed

- **B-5 color spec compliance** — dark mode `--input` luminance corrected from 12% to 18% per L3 interactive controls specification

## [0.2.7] - 2026-03-30

Keyboard navigation for secret cards.

### Added

- **Keyboard navigation for secret cards** — Arrow keys navigate the card grid from the search input (`⌘K`), Enter/Space copies OTP with flip animation, Escape returns to search. Column count adapts to responsive layout via ResizeObserver.

### Fixed

- **Selected card ring color** — keyboard-selected cards now use the theme purple ring (`ring-ring`) consistent with search input focus style, instead of white

## [0.2.6] - 2026-03-30

Playwright auth fix and full six-dimension quality verification.

### Fixed

- **Playwright auth setup** — previous setup silently skipped login because the custom sign-in page (`/`) only renders the Google OAuth button; now POSTs directly to the NextAuth credentials callback endpoint to obtain the JWT session cookie

### Test Coverage

- **49 test files**, **939 Vitest tests** passing
- **34 API E2E tests**, **40 Playwright E2E tests** — all passing
- Six-dimension quality gate: L1 ✅ L2 ✅ L3 ✅ G1 ✅ G2 ✅ D1 ✅ (**Tier S**)

## [0.2.5] - 2026-03-29

Bug fixes, dependency security patches, and UI polish.

### Fixed

- **ESM build breakage** — reverted `brace-expansion` override that caused `ERR_PACKAGE_PATH_NOT_EXPORTED` at build time
- **8 dependency CVEs** — resolved via targeted `overrides` in package.json (cookie, esbuild, picomatch, yaml)
- **Content page UI violations** — fixed B-4 spec issues across 13 files (page layouts, component consistency)

### Changed

- Removed dead `rounded-island` CSS variable and unused Tailwind `extend` entry

## [0.2.4] - 2026-03-29

Dashboard architecture overhaul and test isolation infrastructure.

### Added

- **D1 test isolation guards** — `d1-test-guard.ts` with `_test_marker` table validation, URL inequality check, and `verify-test-bindings.ts` pre-flight script (5 files, 390 lines)
- **README rewrite** — aligned with personal project documentation standard

### Changed

- **Gen 2 context architecture** — upgraded dashboard from prop-drilling to React Context pattern (B-2 spec); 13 files refactored, 662 insertions / 404 deletions

### Test Coverage

- **49 test files**, **939 Vitest tests** passing

## [0.2.3] - 2026-03-24

Recycle bin for soft-deleted secrets and Cmd+K search focus.

### Added

- **Recycle Bin** — soft-delete secrets instead of hard-delete; new `/dashboard/recycle` page with restore and permanent-delete actions
- **Cmd+K shortcut** — global keyboard shortcut to focus the search input on Secrets page, with visual `⌘K` badge
- **`useHotkey` hook** — reusable lightweight keyboard shortcut hook supporting Cmd (Mac) / Ctrl
- Database migration `0002_recycle_bin.sql` adding `deleted_at` column to secrets table
- Recycle Bin nav entry in sidebar under "Secret" group
- `useRecycleBinViewModel` following existing MVVM pattern
- Server actions: `getDeletedSecrets`, `restoreSecret`, `permanentDeleteSecret`, `emptyRecycleBin`

### Changed

- Delete confirmation dialog text updated from "This action cannot be undone" to "The secret will be moved to Recycle Bin"
- `ScopedDB.deleteSecret()` now performs soft-delete (`UPDATE SET deleted_at`) instead of hard `DELETE`
- All existing secret queries filter `deleted_at IS NULL` automatically

### Test Coverage

- **50 test files**, **976 Vitest tests** passing
- Added recycle bin viewmodel tests, server action tests, and ScopedDB recycle bin method tests

## [0.2.2] - 2026-03-23

Quality system upgrade to six-dimension architecture (L1/L2/L3 + G1/G2 + D1).

### Added

- **G1 Static Analysis** — `tsc --noEmit` type-check gate in pre-commit hook
- **G2 Security Gate** — `osv-scanner` (dependency CVEs) + `gitleaks` (secret detection) in pre-push hook
- **D1 Test Isolation** — `[env.test]` config in worker `wrangler.toml` with dedicated `neo-db-test` D1 instance
- Security scan script (`scripts/run-security.ts`) with Bun shell
- OSV-scanner config (`.osv-scanner.toml`) with known-exception allowlist

### Changed

- Promoted `@typescript-eslint/no-unused-vars` from `warn` to `error` for zero-tolerance lint
- Expanded coverage thresholds: `viewmodels/**` ≥90%, `actions/**` ≥85%, `lib/**` ≥80%
- Updated hook comments to quality system naming (L1/G1/L2/G2)

### Fixed

- Resolved all TypeScript strict-mode errors across 10+ test files (ActionResult narrowing, OtpAlgorithm literals, Date types, mock properties)
- Fixed 3 dependency CVEs: next→15.5.14, cookie/esbuild via overrides

### Test Coverage

- **47 test files**, **886+ Vitest tests** passing
- Quality tier upgraded from **B** to **S** (all six dimensions green)

## [0.2.1] - 2026-03-21

Test infrastructure hardening and UI polish.

### Fixed

- ESLint now ignores `public/sw.js` (Serwist build artifact) — resolves lint failure with `--max-warnings=0`
- Transparent border added to non-outline button variants
- Unified button sizes on backup page to `size="sm"`
- Hydration mismatch on sidebar `<aside>` element resolved
- Sidebar animation timing aligned with basalt spec (150ms)
- Logo jitter prevented during sidebar collapse/expand
- `transition-[width]` used instead of `transition-all` for sidebar animation

### Changed

- Removed Appearance and Language sections from settings page

### Test Coverage

- **47 test files**, **886 Vitest tests** passing
- Unit test coverage: **95.1% statements / 96.3% lines** (up from 83%)
- Added tests: auth-context, middleware, d1-client, ScopedDB, theme-toggle, dashboard layout VM
- Added catch-branch tests for backy, secrets, and settings viewmodel
- Excluded low-ROI thin wrappers from coverage targets

## [0.2.0] - 2026-03-20

Encrypted backup system overhaul, UI polish, and deployment hardening.

### Added

**Backup Consolidation**
- AES-GCM 256-bit encrypted ZIP archive model with fflate compression
- Backy integration model for off-site encrypted backup push
- Backup route handlers: download archive, push to Backy, restore from ZIP
- Encryption key management in Settings (generate, reveal, copy, regenerate)
- Backy webhook config with connection test and pull webhook key
- D1 legacy backup migration route with export banner
- Upload size and decompression limits on restore route

**UI Enhancements**
- Redesigned secrets page with responsive card grid layout
- 3D card flip animation on OTP copy
- Color column for secrets with color picker in edit dialog
- Alphabetical sorting of secrets by name
- Collapsible sidebar nav groups with smooth animation
- Unified sidebar with single `<aside>` and CSS width transition
- Compact icon-only action buttons on secrets page
- Removed duplicate page titles (shell header as single source)
- Project logo integrated across all touchpoints
- Step Two (macOS/iOS) RTF import format support

**Infrastructure**
- Worker rate-limit migrated from in-memory Map to D1-backed storage
- Backup restore with hash-based deduplication via batchImportSecrets
- DB-saved theme synced to next-themes on settings load

### Changed

- Rewritten backup page for archive-based flow (replaced old blob-based backup)
- Removed worker cron backup, dead code, and stale tests
- Sidebar footer aligned with basalt design pattern
- Login page aligned with basalt badge card design
- ThemeToggle converted to 3-state cycling (system/light/dark)
- Dev port changed from 7021 to 7042, then to 7026

### Fixed

- ALLOWED_EMAILS fail-closed instead of fail-open
- Backup download button wired with blob download handler
- Duplicate detection added to batch import
- OTP parameter validation on createSecret/updateSecret
- Dialog overlay gap fixed by portaling to document.body
- Uint8Array.from() for fflate cross-realm compatibility
- Cast Uint8Array.buffer to ArrayBuffer for Web Crypto API
- Railway container networking (bind to 0.0.0.0)
- Docker build fixes (base image, lockfile, tsconfig context)

### Test Coverage

- **42 test files**, **813 Vitest tests** passing
- Import-parsers coverage boosted to 95%+
- Backy server action tests added


Initial release — complete modernization from Cloudflare Workers template-string app to Next.js 15 full-stack PWA.

### Added

**Phase 1: Project Skeleton**
- Next.js 15 + React 19 + TypeScript project setup with Bun
- Tailwind CSS 3 + shadcn/ui design system with HSL tokens
- ESLint 9 flat config + Husky pre-commit hooks
- NextAuth v5 + Google OAuth with `ALLOWED_EMAILS` whitelist
- Middleware-based route protection
- App Router layout with dashboard shell

**Phase 2: Infrastructure Layer**
- Cloudflare D1 HTTP client with Drizzle ORM schema
- `ScopedDB` multi-tenant database abstraction (per-user isolation)
- Structured 5-level logger
- Sliding window + fixed window rate limiting (5 presets)
- i18n system with English and Chinese (Simplified)
- Health check (`/api/health`) and liveness probe (`/api/live`)

**Phase 3: Model Layer (TDD)**
- OTP engine: TOTP/HOTP generation with SHA-1/256/512, Web Crypto API
- Base32 codec with RFC 4648 compliance
- Secret parser: `otpauth://` URI parsing and generation
- 18+ import format parsers (Aegis, andOTP, 2FAS, Bitwarden, Google Authenticator, etc.)
- 17+ export format generators
- AES-GCM 256-bit encryption/decryption
- Backup model with hash-based deduplication

**Phase 4: Worker Backend**
- Cloudflare Worker for edge tasks
- Quick OTP endpoint for fast code generation
- Favicon proxy with waterfall across 4 sources
- Cron-triggered daily backup

**Phase 5: ViewModel + View Layer**
- Server Actions for secrets, backup, settings, dashboard
- ViewModel hooks bridging actions to React components
- Secret list with search, TOTP countdown, copy-to-clipboard
- Secret form dialog (add/edit) with validation
- Import/export dialogs supporting all formats
- Backup management view
- Settings view (theme, language, encryption)
- Developer tools (QR codec, Base32 codec, key generator, time-step visualizer)
- App sidebar with navigation and version badge
- Delete confirmation dialog
- Theme toggle (light/dark/system)

**Phase 6: PWA + Offline**
- Serwist 9 service worker with precache + runtime caching
- PWA manifest with shortcuts, maskable icons, protocol handlers
- IndexedDB offline queue with retry logic
- Background sync with handler registry
- `web+otpauth://` protocol handler registration
- Offline fallback page
- PWA install prompt component

**Phase 7: E2E Tests + Deployment**
- API E2E test infrastructure with MockScopedDB
- 58 API E2E tests (secrets CRUD, backup, settings, dashboard)
- Playwright E2E configuration with auth setup
- 35 Playwright tests (auth flows, secrets, backup, tools, settings)
- Multi-stage Dockerfile for Railway deployment
- Production-ready `.dockerignore`

### Test Coverage

- **41 test files**, **697 Vitest tests** passing
- **35 Playwright E2E tests**
- Coverage target: ≥90% on model and lib layers
