<p align="center"><img src="logo.png" width="128" height="128"/></p>

<h1 align="center">Neo</h1>

<p align="center"><strong>全栈 2FA 认证器</strong><br>TOTP/HOTP 管理 · 加密存储 · 离线可用 · 多格式导入导出</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black" alt="Next.js 15"/>
  <img src="https://img.shields.io/badge/React-19-61dafb" alt="React 19"/>
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178c6" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/tests-976%20unit%20%2B%2040%20E2E-brightgreen" alt="Tests"/>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License"/>
</p>

---

## 这是什么

Neo 是一个全栈 TOTP/HOTP 认证器，基于 Next.js 15 + Cloudflare D1 构建。采用 MVVM 架构，ViewModel 完全解耦视图层，所有密钥操作通过 Server Actions 在服务端完成，数据库按用户隔离。支持 PWA 离线使用、18+ 格式导入导出、AES-GCM 256-bit 加密存储。

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

## 功能

### 核心

- **OTP 引擎** — TOTP/HOTP 生成，支持 SHA-1/256/512 算法，6/8 位验证码，纯 Web Crypto API 实现
- **密钥管理** — CRUD + 批量导入（≤100 条）+ 重复检测
- **加密存储** — AES-GCM 256-bit 加密，格式 `v1:<iv>:<ciphertext>`，支持按账户独立加密
- **导入导出** — 18+ 导入格式，17+ 导出格式（Aegis, andOTP, 2FAS, Bitwarden, Google Authenticator 等）

### 基础设施

- **备份系统** — 事件驱动（5 分钟防抖）+ 定时任务（每日 UTC 16:00，hash 去重），保留最近 100 份
- **PWA** — Service Worker (Serwist)，离线队列 (IndexedDB)，Background Sync，协议处理器 (`web+otpauth://`)
- **限流** — 滑动窗口 + 固定窗口，5 种预设策略
- **Favicon 代理** — 瀑布式查询 4 个来源（兼容 Google 不可用的地区）
- **认证** — NextAuth v5 + Google OAuth，`ALLOWED_EMAILS` 白名单
- **国际化** — 英文 / 简体中文，客户端切换

### 开发者工具

- **QR 编解码** — 二维码编码与解码
- **Base32 编解码** — Base32 编码与解码
- **密钥强度检查** — 评估 OTP 密钥安全性
- **随机密钥生成** — 生成符合规范的随机密钥
- **TOTP 时间步可视化** — 实时展示 TOTP 时间步进度

## 安装

```bash
# 克隆仓库
git clone https://github.com/nocoo/neo.git
cd neo

# 安装依赖
bun install

# 配置环境变量
cp .env.example .env.local

# 启动开发服务器（端口 7042）
bun run dev
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `bun run dev` | 启动开发服务器（Turbopack，端口 7042） |
| `bun run build` | 生产构建 |
| `bun run start` | 启动生产服务器 |
| `bun run lint` | ESLint 检查（`--max-warnings=0`） |
| `bun run typecheck` | TypeScript 类型检查（`tsc --noEmit`） |
| `bun run test:run` | 运行全部 Vitest 测试 |
| `bun run test:unit` | 仅单元测试 |
| `bun run test:unit:coverage` | 单元测试 + 覆盖率报告 |
| `bun run test:api` | API E2E 测试 |
| `bun run test:e2e:pw` | Playwright E2E 测试 |
| `bun run test:security` | 安全扫描（osv-scanner + gitleaks） |

## 项目结构

```
neo/
├── actions/        # Server Actions（secrets, backup, settings, dashboard）
├── app/            # Next.js App Router 页面和 API 路由
├── components/     # React 组件（视图 + UI 基础组件）
├── contexts/       # React Context providers
├── hooks/          # 自定义 React hooks
├── i18n/           # 国际化（en, zh-CN）
├── lib/            # 核心库（db, auth, PWA, logger）
├── models/         # 领域模型、类型和常量
├── viewmodels/     # ViewModel hooks（业务逻辑桥接层）
├── worker/         # Cloudflare Worker 边缘任务
├── tests/          # Vitest + Playwright 测试套件
├── drizzle/        # 数据库迁移文件
├── docs/           # 项目文档
└── scripts/        # 构建与工具脚本
```

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | [Next.js 15](https://nextjs.org/) (App Router, Turbopack) |
| 运行时 | [Bun](https://bun.sh/) |
| UI | [React 19](https://react.dev/) + [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS 3](https://tailwindcss.com/) |
| 数据库 | [Cloudflare D1](https://developers.cloudflare.com/d1/) (HTTP API) + [Drizzle ORM](https://orm.drizzle.team/) |
| 认证 | [NextAuth v5](https://authjs.dev/) + Google OAuth |
| PWA | [Serwist 9](https://serwist.pages.dev/) |
| Worker | [Cloudflare Workers](https://workers.cloudflare.com/)（Quick OTP, Favicon, Cron） |
| 测试 | [Vitest 4](https://vitest.dev/) (976 tests) + [Playwright](https://playwright.dev/) (40 E2E specs) |

## 开发

### 环境要求

- [Bun](https://bun.sh/) >= 1.0
- Cloudflare D1 数据库（HTTP API 访问）
- Google OAuth 凭证

### 快速开始

```bash
bun install
bun run dev
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `AUTH_SECRET` | NextAuth 签名密钥 |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |
| `AUTH_URL` | 应用 URL |
| `ALLOWED_EMAILS` | 逗号分隔的允许邮箱列表 |
| `CF_API_TOKEN` | Cloudflare API Token |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |
| `CF_D1_DATABASE_ID` | D1 数据库 ID |
| `ENCRYPTION_KEY` | AES-GCM 256-bit 密钥（可选） |
| `SENTRY_DSN` | Sentry 错误追踪（可选） |

### 部署（Railway）

项目包含多阶段 Dockerfile，针对 Railway 优化：

```bash
docker build -t neo .
docker run -p 7042:7042 --env-file .env neo
```

### Cloudflare Worker

边缘 Worker 独立处理轻量任务：

```bash
cd worker
bun install
bun run dev      # 本地开发（端口 8787）
bun run deploy   # 部署到 Cloudflare
```

## 测试

六维质量体系（L1+L2+L3+G1+G2+D1），详见 [docs/04-quality-system-upgrade.md](./docs/04-quality-system-upgrade.md)。

| 维度 | 工具 | Hook | 状态 |
|------|------|------|------|
| **L1** 单元/组件 | Vitest（925 tests，95%+ 覆盖率） | pre-commit | ✅ |
| **L2** 集成/API | Vitest（51 API E2E tests） | pre-push | ✅ |
| **L3** 系统/E2E | Playwright（40 specs） | manual/CI | ✅ |
| **G1** 静态分析 | `tsc --noEmit` + ESLint `--max-warnings=0` | pre-commit | ✅ |
| **G2** 安全 | osv-scanner + gitleaks | pre-push | ✅ |
| **D1** 测试隔离 | `neo-db-test`（Cloudflare D1） | — | N/A |

**Tier: S** — 全维度绿灯（N/A 视为绿灯）。

```bash
bun run test:run            # L1 + L2 全部测试
bun run test:e2e:pw         # L3 Playwright E2E
bun run lint && bun run typecheck  # G1 静态分析
bun run test:security       # G2 安全扫描
```

## 文档

| # | 文档 | 说明 |
|---|------|------|
| 01 | [Modernization Plan](./docs/01-modernization-plan.md) | 现代化改造：目标、架构、测试策略、提交计划 |
| 02 | [Backup Consolidation](./docs/02-backup-consolidation.md) | 四套备份子系统统一为加密归档 → Backy webhook 流程 |
| 03 | [Test Coverage Improvement](./docs/03-test-coverage-improvement.md) | 测试基础设施升级至四层标准 |
| 04 | [Quality System Upgrade](./docs/04-quality-system-upgrade.md) | 四层测试 → 六维质量体系（L1/L2/L3+G1/G2+D1） |
| 05 | [Quality System V2 Upgrade](./docs/05-quality-system-v2-upgrade.md) | 重审计：L2 mock→真实 HTTP + D1 三层验证 |

## License

[MIT](LICENSE) © 2026