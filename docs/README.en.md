<p align="center">
  <img src="../assets/brand/icon-rounded.png" alt="Neo" width="128" height="128" />
</p>

<h1 align="center">Neo</h1>

<p align="center">Manage two-factor authentication secrets, view TOTP codes, and maintain backups in your browser.</p>

<p align="center">
  <a href="https://neo.hexly.ai">Website</a> ·
  <a href="../README.md">简体中文</a>
</p>

## What it does

Neo is a self-hosted web authenticator. Sign in with Google to manage authentication secrets, generate TOTP codes in the browser, and import or export data when moving between authenticators. The server uses Next.js, with application data stored in Cloudflare D1 and queried per user.

The database currently stores Base32 secrets readable by the server. AES-GCM encryption applies to exported backup ZIP files, and the backup encryption key is also stored in D1. Using the service requires trusting the operator and their database access controls.

## Features

- Find secrets by name or account, add and edit entries, and copy TOTP codes. Supports SHA-1 / SHA-256 / SHA-512, 6 / 8 digits, and 30 / 60-second periods.
- Move deleted entries to a recycle bin, restore them, or permanently delete individual entries or empty the bin.
- Import and export `otpauth://` URIs and supported plaintext formats from Aegis, andOTP, 2FAS, Bitwarden, and other tools, with duplicate checking during batch imports.
- Download AES-GCM-encrypted backup ZIP files and restore them with the matching key; configure Backy push and pull webhooks for off-site archive storage.
- Preview imports, convert export formats, and test TOTP parameters on the Tools page.
- Switch between English and Chinese and light or dark themes; install as a PWA with an offline fallback page.

The data model and importers include HOTP fields, while the main interface currently generates TOTP codes only. Login, reading current data, and modifying secrets require a network connection. PWA caching and an offline fallback do not provide complete offline secret management. Encrypted third-party exports must first be converted to a supported format in the original tool.

## Usage

1. Open the [website](https://neo.hexly.ai) and sign in with a Google account allowed by the operator.
2. Add an entry on the secrets page, or open Import to paste or upload a supported plaintext export.
3. Search by name or account and copy the current TOTP code from its card.
4. For backups, generate and separately save an encryption key in Settings, then download an archive from Backup. Restoring requires the key used for that archive.

Backy is optional. Configure its webhook URL and API key in Settings to push archives manually. Scheduled backups are triggered when Backy calls Neo's `/api/backy/pull`; see the [backup guide](02-backup-consolidation.md).

## Development

Requires Bun, Node.js 22.12+, Google OAuth credentials, and a Cloudflare D1 database accessible through its HTTP API.

```bash
git clone https://github.com/nocoo/neo.git
cd neo
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
```

The repository has no `.env.example`. Create `.env.local` and configure:

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Auth.js session signing secret |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials |
| `AUTH_URL` | `http://localhost:7026` locally; the actual site URL when deployed |
| `ALLOWED_EMAILS` | Comma-separated login allowlist; an empty list rejects all logins |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account containing D1 |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 database ID |
| `CLOUDFLARE_API_TOKEN` | API token authorized to query the target D1 |

Set the local Google OAuth callback to `http://localhost:7026/api/auth/callback/google`. Apply these SQL files in order to a new D1 database; the application does not create tables on startup:

1. [Initial schema](../drizzle/0000_pink_archangel.sql)
2. [Entry color field](../drizzle/0001_green_karnak.sql)
3. [Recycle bin field](../drizzle/0002_recycle_bin.sql)
4. [Backup key and Backy fields](../migrations/0001_add_backy_and_encryption_key.sql)

```bash
bun run dev       # Webpack development server, http://localhost:7026
bun run build     # Production build, including the Serwist service worker
bun run start     # Run the production build locally on port 7026
```

`bun run typecheck` checks both the main app and `worker/`; `bun run lint` uses Biome. The main app can also be deployed using the [Dockerfile](../Dockerfile).

The optional `worker/` provides `POST /otp`, `GET /favicon/:domain`, and `/health`. It runs separately from Next.js and needs its own Wrangler configuration and D1 rate-limit table. When using [wrangler.toml.example](../worker/wrangler.toml.example), replace the D1 binding and remove its leftover cron configuration; the current Worker has no `scheduled` handler. After preparing the configuration and [SQL](../worker/migrations/0001_rate_limits.sql), run `bun run --cwd worker dev`.

```text
actions/           Server-side secret, settings, and backup operations
app/               Next.js pages, APIs, and service worker
components/        Interface components
viewmodels/        UI state and interaction logic
models/            OTP, import/export, and encrypted archives
lib/db/            D1 HTTP client and user-scoped queries
worker/            Optional OTP and favicon service
```

## Tests

Run from the repository root:

| Test layer | Command |
| --- | --- |
| Main app unit and component tests | `bun run test:unit` |
| Server Action integration tests | `bun run test:api` |
| Local HTTP end-to-end tests | `bun run test:e2e` |
| Browser smoke test | `bun run test:e2e:pw` |
| Separate Worker unit tests | `bun run --cwd worker test` |

Server Action tests replace D1 with in-memory storage. HTTP tests start Next.js on port `17026` with a test identity and an in-memory database; keep that port free before running. For browser tests, first run `bunx playwright install chromium`. They start a server on port `27026`; the current case checks login-page loading. These tests do not require real D1 data or Google sign-in.

## Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Cloudflare D1](https://img.shields.io/badge/Cloudflare_D1-F38020?logo=cloudflare&logoColor=white)
![Web Crypto](https://img.shields.io/badge/Web_Crypto-555555)

| Area | Implementation |
| --- | --- |
| Web app | Next.js App Router, React, Tailwind CSS, Basalt UI |
| Authentication and data | Auth.js / NextAuth, Google OAuth, D1 HTTP API; Drizzle schema definitions |
| OTP and backups | Web Crypto, fflate, Backy webhooks |
| PWA and optional service | Serwist, Cloudflare Workers |
| Development and testing | Bun, Webpack, TypeScript, Biome, Vitest, Playwright |

## Documentation

- [Documentation index](README.md)
- [Backup archives and Backy design](02-backup-consolidation.md)
- [Database schema](../lib/db/schema.ts)
- [Changelog](../CHANGELOG.md)

Historical design documents retain migration steps and superseded approaches. Use this README and the source code for current entry points and commands.

## License

[MIT](../LICENSE) © 2026
