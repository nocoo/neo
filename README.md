# Neo

Modern TOTP/HOTP authenticator — a full-stack 2FA manager built with Next.js 15, React 19, and Cloudflare D1.

## Features

- **OTP Engine** — TOTP/HOTP generation with SHA-1/256/512, 6/8-digit codes, pure Web Crypto API
- **Secret Management** — CRUD + batch import (≤100) + duplicate detection
- **Import/Export** — 18+ import formats, 17+ export formats (Aegis, andOTP, 2FAS, Bitwarden, Google Authenticator, etc.)
- **Encrypted Storage** — AES-GCM 256-bit encryption, format `v1:<iv>:<ciphertext>`, optional per-account
- **Backup System** — Event-driven (5-min debounce) + cron (daily UTC 16:00 with hash dedup), retains latest 100
- **PWA** — Service Worker (Serwist), offline queue (IndexedDB), Background Sync, protocol handler (`web+otpauth://`)
- **Rate Limiting** — Sliding window + fixed window, 5 preset strategies
- **Favicon Proxy** — Waterfall across 4 sources (handles regions where Google is unavailable)
- **Developer Tools** — QR encode/decode, Base32 encode/decode, key strength check, random key generator, TOTP time-step visualizer
- **Authentication** — NextAuth v5 + Google OAuth with `ALLOWED_EMAILS` whitelist
- **i18n** — English and Chinese (Simplified) with client-side language switching

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Runtime | Bun |
| UI | React 19 + shadcn/ui + Tailwind CSS 3 |
| Database | Cloudflare D1 (via HTTP API) + Drizzle ORM |
| Auth | NextAuth v5 + Google OAuth |
| PWA | Serwist 9 |
| Worker | Cloudflare Workers (edge tasks: Quick OTP, Favicon, Cron) |
| Testing | Vitest 4 (697 tests) + Playwright (35 E2E tests) |

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐
│   View      │ →  │  ViewModel   │ →  │  Server Action  │
│  (React)    │    │  (hooks)     │    │  (use server)   │
└─────────────┘    └──────────────┘    └───────┬────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   ScopedDB (D1)     │
                                    │   per-user isolation │
                                    └─────────────────────┘
```

**Pattern**: Model → ViewModel → View + Server Actions with per-user scoped database access.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- Cloudflare D1 database (with HTTP API access)
- Google OAuth credentials

### Environment Variables

```bash
# Auth
AUTH_SECRET=           # NextAuth signing secret (openssl rand -hex 32)
AUTH_GOOGLE_ID=        # Google OAuth Client ID
AUTH_GOOGLE_SECRET=    # Google OAuth Client Secret
AUTH_URL=              # App URL (e.g., https://neo.example.com)
ALLOWED_EMAILS=        # Comma-separated allowed emails

# Database
CF_API_TOKEN=          # Cloudflare API token
CF_ACCOUNT_ID=         # Cloudflare account ID
CF_D1_DATABASE_ID=     # D1 database ID

# Optional
SENTRY_DSN=            # Sentry error tracking
ENCRYPTION_KEY=        # AES-GCM 256-bit key for secret encryption
```

### Development

```bash
# Install dependencies
bun install

# Run development server (port 7021)
bun run dev

# Run tests
bun run test:run          # All 697 Vitest tests
bun run test:unit         # Unit tests only
bun run test:api          # API E2E tests only
bun run test:e2e:pw       # Playwright E2E tests

# Lint
bun run lint

# Build
bun run build
```

### Deployment (Railway)

The project includes a multi-stage Dockerfile optimized for Railway:

```bash
# Build image
docker build -t neo .

# Run container
docker run -p 7021:7021 --env-file .env neo
```

**Railway setup:**
1. Connect GitHub repo to Railway
2. Set all environment variables in Railway dashboard
3. Railway auto-detects the Dockerfile and deploys

The app runs on port **7021** with `output: "standalone"` for minimal image size.

### Cloudflare Worker

The edge worker handles lightweight tasks independently:

```bash
cd worker
bun install
bun run dev    # Local dev on port 8787
bun run deploy # Deploy to Cloudflare
```

## Project Structure

```
neo/
├── actions/        # Server Actions (secrets, backup, settings, dashboard)
├── app/            # Next.js App Router pages and API routes
├── components/     # React components (views + ui primitives)
├── contexts/       # React Context providers
├── hooks/          # Custom React hooks
├── i18n/           # Internationalization (en, zh-CN)
├── lib/            # Core libraries (db, auth, PWA, logger)
├── models/         # Domain models, types, and constants
├── viewmodels/     # ViewModel hooks (business logic bridge)
├── worker/         # Cloudflare Worker backend
├── tests/          # Vitest + Playwright test suites
├── drizzle/        # Database migrations
└── docs/           # Project documentation
```

## Testing

| Layer | Tool | Count | Purpose |
|-------|------|-------|---------|
| Unit | Vitest | 697 | Models, libs, actions, viewmodels, components |
| API E2E | Vitest | 58 | Full action → mock DB flow |
| Browser E2E | Playwright | 35 | Auth, navigation, UI interactions |

## Documentation

See [docs/](./docs/) for detailed documentation including the full modernization plan.

## License

Private project.
