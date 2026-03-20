# Changelog

All notable changes to this project will be documented in this file.

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
- Dev port changed from 7021 to 7042

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
