# 01 - 2FA Manager Modernization Plan

## 目标

将参考项目 `../2fa`（Cloudflare Worker 全栈 2FA 管理器）进行现代化改造，基于 `../zhe` 的 Next.js 架构重建，同时保留全部业务功能。

三大核心目标：

1. **框架现代化** — 从无框架模板字符串迁移到 Next.js 15 + React 19 + TypeScript + MVVM
2. **UI 替换** — 用 shadcn/ui + Tailwind CSS 4 + HSL 设计 token 重建全部界面
3. **四层测试** — 建立 UT + Lint + API E2E + BDD E2E 完整验证结构

---

## 一、参考项目分析

### 1.1 现有技术栈

| 维度 | 现状 |
|------|------|
| 运行时 | Cloudflare Workers (V8 isolate) |
| 存储 | Cloudflare KV (`SECRETS_KV`) |
| 前端 | 模板字符串拼接 HTML，零框架 |
| 样式 | CSS-in-JS 字符串 |
| 类型 | 纯 JavaScript，无类型 |
| 构建 | esbuild 单文件打包 |
| 包管理 | npm |
| 认证 | PBKDF2 + 手工 JWT + HttpOnly Cookie |
| 加密 | AES-GCM 256-bit (Web Crypto API) |
| 测试 | Vitest 4.x, 598 用例（仅后端） |

### 1.2 保留的业务功能清单

以下功能必须在新项目中完整保留：

| 模块 | 功能 |
|------|------|
| **OTP 引擎** | TOTP/HOTP 生成，SHA-1/256/512，6/8 位，Web Crypto API 纯实现 |
| **密钥管理** | CRUD + 批量导入（≤100 条）+ 重复检测 |
| **导入** | 18+ 格式：Aegis, andOTP, 2FAS, Authenticator Pro, Bitwarden, Ente Auth, FreeOTP/FreeOTP+, LastPass, Proton, WinAuth, Google Authenticator 等 |
| **导出** | 17+ 格式：含加密格式（TOTP Auth, FreeOTP） |
| **认证** | ~~PBKDF2 密码~~ → NextAuth v5 + Google OAuth (HttpOnly Cookie sessions) |
| **加密存储** | AES-GCM 256-bit，格式 `v1:<iv>:<ciphertext>`，可选开启，自动检测 |
| **备份** | 事件驱动（防抖 5 分钟）+ Cron 定时（每日 UTC 16:00，先比对 `last_backup_hash`，数据无变化则跳过），保留最新 100 个 |
| **PWA** | Service Worker (Serwist), 离线队列 (IndexedDB), Background Sync, Protocol handler |
| **限流** | 滑动窗口（默认）+ 固定窗口，5 种预设策略 |
| **Favicon 代理** | 瀑布尝试 4 个源，解决国内 Google 不可用 |
| **开发者工具** | QR 编解码, Base32 编解码, 密钥强度检查, 随机密钥生成, TOTP 时间步长可视化 |
| **日志 & 监控** | 结构化 5 级日志, Sentry 集成(可选), 性能追踪 |

### 1.3 已知问题（迁移中修复）

| 编号 | 问题 | 修复方案 |
|------|------|----------|
| P1 | `generateTOTP` vs `generateOTP` counter 写入不一致（低 32 位 vs 64 位） | 统一为 64 位写入 |
| P2 | 常量重复硬编码（`constants.js` vs `auth.js` 各自定义 `PBKDF2_ITERATIONS`） | 单一来源 `models/constants.ts` |
| P3 | `errorToResponse` 内联 CORS `*`，与 `security.js` 动态同源策略矛盾 | 统一通过 `worker/src/security.ts` |
| P4 | `worker.js` ↔ `shared.js` 循环依赖 | `generateDataHash/saveDataHash` 移入 `worker/src/utils/` |
| P5 | `logger.info('Test', null)` 抛 TypeError | 添加 null guard |
| P6 | auth.js 未导出内部函数，测试复制实现代码 | 导出函数，直接测试 |
| P7 | 认证系统为密码 + JWT，不适合现代化个人项目 | 替换为 NextAuth v5 + Google OAuth（见第七章） |

---

## 二、目标技术栈

| 维度 | 目标 | 来源 |
|------|------|------|
| **运行时** | Bun | zhe 一致 |
| **框架** | Next.js 15 (App Router) | zhe 一致，SSR auth, Server Actions |
| **UI 框架** | React 19 + TypeScript (strict) | zhe 一致 |
| **样式** | Tailwind CSS 4 + CSS 变量设计 token | zhe 一致 |
| **组件库** | shadcn/ui (Radix UI) | zhe 一致 |
| **图标** | Lucide React (1.5px strokeWidth) | zhe 一致 |
| **认证** | NextAuth v5 + Google OAuth | zhe 一致，HttpOnly Cookie sessions |
| **数据库** | Cloudflare D1 (关系型 schema) | 替换 KV，ScopedDB 行级安全 |
| **ORM** | Drizzle (schema only) | zhe 一致，类型来自 schema，查询用 raw SQL |
| **i18n** | i18next + react-i18next | 新增 |
| **Toast** | Sonner | zhe 一致 |
| **架构** | MVVM (Model → ViewModel → View) + Server Actions | zhe 模式 |
| **主题** | 3 态 (system/light/dark) + HSL token | zhe 一致 |
| **PWA** | Serwist | 现代 next-pwa 继承者，TS 原生 |
| **测试** | Vitest 4 + @testing-library/react + Playwright | zhe 一致 |
| **Lint** | ESLint 9 (flat config) | zhe 一致 |
| **Git hooks** | Husky 9 | zhe 一致 |
| **Worker** | Cloudflare Workers (独立包) | Quick OTP, Favicon, Cron 备份, 限流 |
| **部署** | Railway (Next.js standalone) + Cloudflare (Worker) | 分离关注点 |

---

## 三、架构设计

### 3.1 双端架构

```
Railway (Next.js 15)              Cloudflare Worker (Edge)
├── SSR/SSG frontend               ├── Quick OTP /otp/:secret
├── NextAuth + Google OAuth         ├── Favicon proxy
├── Server Actions → D1 HTTP API   ├── Cron daily backup (D1 binding)
├── PWA via Serwist                 ├── Rate limiting (KV)
└── Dockerfile standalone           └── Security headers
```

Next.js 应用是主体，负责所有用户界面、认证和数据操作。Worker 仅处理轻量边缘任务。

### 3.2 MVVM 分层

```
┌─────────────────────────────────────────────────────────────┐
│                         View (Pages)                        │
│  app/page.tsx (登录)  · app/(dashboard)/dashboard/           │
│  纯展示，只消费 ViewModel hooks                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ 消费
┌──────────────────────────▼──────────────────────────────────┐
│                    ViewModel (Hooks)                         │
│  useSecretsViewModel / useBackupViewModel / useToolsVM ...  │
│  useMemo 组合 model + server action 结果，返回 view-ready    │
└──────────────────────────┬──────────────────────────────────┘
                           │ 调用
┌──────────────────────────▼──────────────────────────────────┐
│              Server Actions + Model (Pure TS)               │
│  actions/secrets.ts (use server) → models/otp.ts, etc.      │
│  零 React 依赖，ActionResult<T> 统一返回                      │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**：

- **Model** — 零 React 依赖，纯函数 + TypeScript 接口，所有业务逻辑在此层
- **Server Actions** — `'use server'` 函数，调用 ScopedDB 和 Model，返回 `ActionResult<T>`
- **ViewModel** — `"use client"` hooks，调用 Server Actions，用 `useMemo` 组合返回 View-ready 结构
- **View** — 纯展示，只消费 ViewModel hooks，从不直接导入 model 或 action

### 3.3 关键模式 (从 zhe 复用)

| 模式 | 说明 |
|------|------|
| **ActionResult\<T\>** | `{ success, data?, error? }` — 所有 Server Action 的统一返回类型 |
| **ScopedDB** | userId 在构造时绑定，所有用户数据访问必须通过 ScopedDB 封装方法（各方法内手写带 user_id 的 SQL） |
| **Split Context** | `DashboardStateContext` + `DashboardActionsContext` 分离，避免不必要 re-render |
| **React.cache()** | `getSession = cache(() => auth())` 去重每次渲染的 auth 调用 |
| **D1 HTTP API** | `executeD1Query<T>()` 带 5s 超时，底层通过 Cloudflare REST API 操作 D1 |
| **Drizzle schema-only** | 类型来自 schema，查询用 raw SQL，不使用 Drizzle query builder |
| **Standalone Docker** | 3-stage Dockerfile (deps → build → runner) for Railway |
| **E2E Credentials provider** | `PLAYWRIGHT=1` 环境变量启用测试用 Credentials 登录 |

### 3.4 目录结构

```
neo/
├── app/                          # Next.js App Router
│   ├── (dashboard)/dashboard/    # Secrets | Backup | Tools | Settings
│   ├── api/auth/[...nextauth]/   # NextAuth handler
│   ├── api/health/ + api/live/   # Health checks
│   ├── manifest.ts               # PWA manifest
│   ├── sw.ts                     # Serwist Service Worker
│   ├── layout.tsx · globals.css
│   ├── page.tsx                  # 根路径 = 登录页（与 zhe 一致，signIn 配置为 /）
│   └── not-found.tsx · offline/
├── actions/                      # Server Actions (secrets, backup, settings)
├── models/                       # Pure TS business logic (zero React)
│   ├── otp.ts · encryption.ts · validation.ts
│   ├── import-parsers.ts · export-formatters.ts · backup.ts
│   ├── types.ts · constants.ts · errors.ts
├── viewmodels/                   # useXxxViewModel hooks
├── components/                   # ui/ (shadcn) + dashboard/ + secrets/ + tools/
├── contexts/                     # Split State/Actions dashboard context
├── hooks/                        # use-mobile, generic hooks
├── lib/                          # Infrastructure
│   ├── db/ (schema, d1-client, scoped, mappers)
│   ├── auth.ts · auth-adapter.ts · auth-context.ts
│   ├── offline-queue.ts · background-sync.ts
│   └── utils.ts · version.ts · logger.ts
├── i18n/                         # en.json, zh.json
├── middleware.ts                  # Auth + routing
├── worker/                       # Cloudflare Worker (separate package)
│   ├── src/ (index, router, otp, favicon, backup, rate-limit, security)
│   ├── wrangler.toml · test/
├── tests/                        # Four-layer tests
│   ├── unit/ · components/ · api/ · playwright/ · mocks/ · fixtures/
├── drizzle/                      # Migrations
├── Dockerfile                    # Railway (3-stage bun)
├── next.config.ts · vitest.config.ts · playwright.config.ts
├── eslint.config.mjs · drizzle.config.ts · tailwind.config.ts
└── package.json
```

### 3.5 D1 数据库 Schema (替换 KV)

原项目用 KV 存储一个巨大的 JSON 数组。新项目使用 D1 关系型 schema：

| 表 | 用途 |
|----|------|
| **users** / **accounts** / **sessions** / **verificationTokens** | NextAuth 标准表 |
| **secrets** | id (UUID), user_id (FK), name, account, secret, type, digits, period, algorithm, counter, created_at, updated_at |
| **backups** | id, user_id (FK), filename, data, secret_count, encrypted, reason, hash, created_at |
| **user_settings** | user_id (PK FK), encryption_key_hash, theme, language |

ScopedDB 在构造时绑定 userId，所有用户数据访问必须通过其封装方法（每个方法内手写带 `user_id` 条件的 SQL），从而在 class 层面确保不会遗漏权限检查。

---

## 四、四层测试架构

综合利用 **UT + Lint + API E2E + BDD E2E** 四层验证结构，自主、尽早发现问题，避免问题积累。

### 4.1 层级定义

| 层级 | 名称 | 要求 | 工具 |
|------|------|------|------|
| **L1: UT** | 单元测试 | 覆盖率 **≥ 90%** | Vitest 4 + @testing-library/react |
| **L2: Lint** | 代码检查 | 错误、警告 **0 容忍**，strict 模式 | ESLint 9 |
| **L3: API E2E** | 接口端到端 | Server Actions 全覆盖 | Vitest + mock D1 |
| **L4: BDD E2E** | 行为驱动端到端 | 核心主干流程 | Playwright |

### 4.2 UT 分层（L1 内部细分）

对应 MVVM 架构，UT 进一步分为四个子层：

| 子层 | 目录 | 测什么 | 特点 |
|------|------|--------|------|
| **Model** | `tests/unit/models/` | 纯函数：OTP 生成、加解密、验证、解析器 | 零 React、零 mock、最快最稳 |
| **ViewModel** | `tests/unit/viewmodels/` | React hooks 输出形状和计算 | `renderHook()` |
| **Component** | `tests/components/` | UI 组件 DOM 输出 | 传 props → 验证渲染 |
| **Action** | `tests/unit/actions/` | Server Actions 返回值和副作用 | mock ScopedDB |

### 4.3 API E2E 测试矩阵（L3）

Server Actions 替代了 REST API，L3 测试直接调用 Action 函数（mock 认证上下文）：

| Action 模块 | 测试场景 |
|------------|----------|
| `actions/secrets.ts` | CRUD 全流程、重复检测、弱密钥警告、批量导入上限 100、部分失败 |
| `actions/backup.ts` | 创建备份、恢复、预览模式、导出 txt/json/csv |
| `actions/settings.ts` | 读取/更新加密配置、主题、语言 |
| `actions/dashboard.ts` | 聚合数据获取 |

Worker 端点测试（独立）：

| 端点 | 方法 | 测试场景 |
|------|------|----------|
| `GET /otp/:secret` | GET | 有效密钥、无效密钥 |
| `GET /favicon/:domain` | GET | 正常域名、不存在域名、超时 |

### 4.4 BDD E2E 核心流程（L4）

| 流程 | 步骤 |
|------|------|
| **Google 登录** | 打开应用 → 点击 Sign in with Google → NextAuth 认证 → 跳转 dashboard |
| **添加密钥** | 登录 → 添加密钥表单 → 填写 → 保存 → 列表中出现 |
| **OTP 生成** | 登录 → 查看密钥 → OTP 显示 + 倒计时 → 复制 |
| **导入导出** | 登录 → 导入文件 → 预览 → 确认 → 验证数据 → 导出 → 验证文件 |
| **备份恢复** | 登录 → 创建备份 → 删除密钥 → 恢复备份 → 验证数据 |

### 4.5 自动化触发 (Husky)

| 阶段 | 命令 | 内容 |
|------|------|------|
| **pre-commit** | `bun run test:unit:coverage` + `bunx lint-staged` | UT (覆盖率 < 90% 则 Fail) + Lint |
| **pre-push** | `bun run test:api` | API E2E，确保 action 协议没有被伤害 |
| **手动** | `bun run test:e2e:pw` | BDD E2E (Playwright)，按需运行 |

### 4.6 E2E 服务器约定

| 用途 | 端口 | 说明 |
|------|------|------|
| Dev Server (Next.js) | 7021 | `next dev --turbopack` |
| Worker Dev Server | 8787 | `wrangler dev` 默认端口 |
| API E2E Server | 17021 | 独立实例，`PLAYWRIGHT=1` |
| BDD E2E Server | 27021 | Playwright 专用实例 |

- Playwright E2E 使用 Credentials provider 登录，绕开 Google OAuth
- `PLAYWRIGHT=1` 环境变量启用测试用 Credentials 认证

---

## 五、原项目测试保留计划

原项目共 ~593 个测试用例，全部保留并迁移到 TypeScript。下表列出每个测试文件的迁移策略。

### 5.1 测试清单与迁移映射

| 原文件 | 用例数 | 迁移目标 | 迁移策略 |
|--------|--------|----------|----------|
| `tests/setup.js` | — | `tests/setup.ts` | 重写为 TS；Web Crypto polyfill 保留，新增 jest-dom + polyfills + mock D1 |
| `tests/otp/generator.test.js` | ~63 | `tests/unit/models/otp.test.ts` | **直接迁移**，RFC 6238/4226 测试向量全部保留，修复 P1 (counter 64 位统一) |
| `tests/utils/encryption.test.js` | 24 | `tests/unit/models/encryption.test.ts` | **直接迁移**，AES-GCM 往返测试、篡改检测、IV 随机性全部保留 |
| `tests/utils/validation.test.js` | 56 | `tests/unit/models/validation.test.ts` | **直接迁移**，Base32 校验、OTP 参数验证、密钥强度、排序、重复检测全部保留 |
| `tests/utils/auth.test.js` | 54 | — | **移除**：密码哈希/JWT 用例不再适用；新增 NextAuth 相关测试替代 |
| `tests/utils/auth.integration.test.js` | 31 | `tests/api/auth.e2e.test.ts` | **重写为 L3 API E2E**：NextAuth session 验证、`ALLOWED_EMAILS` 白名单、无认证 401 |
| `tests/utils/backup.test.js` | 51 | `tests/unit/models/backup.test.ts` | **直接迁移**，防抖机制、加密/明文备份、自动清理、性能指标全部保留 |
| `tests/utils/logger.test.js` | 66 | `tests/unit/lib/logger.test.ts` | **直接迁移**，5 级日志、脱敏、PerformanceTimer 全部保留；修复 P5 (null data) |
| `tests/utils/monitoring.test.js` | ~79 | `worker/test/utils/monitoring.test.ts` | **直接迁移**，ErrorMonitor/PerformanceMonitor/MonitoringManager、Sentry 集成全部保留 |
| `tests/utils/rateLimit.test.js` | 54 | `worker/test/rate-limit.test.ts` | **直接迁移**，固定窗口算法、5 种预设、withRateLimit 中间件、客户端识别全部保留 |
| `tests/utils/rateLimitSlidingWindow.test.js` | 12 | `worker/test/rate-limit-sliding.test.ts` | **直接迁移**，滑动窗口、窗口边界攻击防护（关键安全测试）全部保留 |
| `tests/utils/response.test.js` | 30 | `worker/test/utils/response.test.ts` | **直接迁移**，JSON/Error/Success/HTML 四种响应、安全头全部保留 |
| `tests/utils/security.test.js` | 44 | `worker/test/security.test.ts` | **直接迁移**，CORS 同源判断、CSP、预检请求、IPv6、localhost 互通全部保留 |
| `tests/api/secrets.test.js` | 30 | `tests/api/secrets.e2e.test.ts` | **迁移为 L3 API E2E**：CRUD 全流程、加密透明性全部保留（改为调用 Server Actions） |
| `tests/api/batch.test.js` | 16 | `tests/api/batch.e2e.test.ts` | **迁移为 L3 API E2E**：批量导入、部分失败、大批量全部保留 |
| `tests/api/backup.test.js` | 34 | `tests/api/backup.e2e.test.ts` | **迁移为 L3 API E2E**：备份创建/列表/恢复/导出全部保留 |
| `tests/router/handler.test.js` | 49 | `worker/test/router.test.ts` | **直接迁移**，路由分发、认证检查、405/404 全部保留；移除 /api/setup, /api/login 路由 |

### 5.2 迁移原则

1. **用例数量不减少** — 原有 ~593 个用例全部保留或等价替换，只增不减
2. **JS → TS** — 所有测试文件从 `.js` 迁移到 `.ts`/`.tsx`，添加类型标注
3. **Mock D1 替代 MockKV** — 原项目 MockKV 类替换为 mock D1 client（参考 zhe 的 `tests/mocks/db-storage.ts` 模式）
4. **RFC 向量不改** — OTP 的 RFC 6238/4226 官方测试向量原封不动保留
5. **安全测试不改** — 滑动窗口边界攻击防护、AES-GCM 完整性校验原封不动保留
6. **已知 bug 修复后更新断言** — P5 (logger null data) 修复后，测试从"验证抛异常"改为"验证正常处理"
7. **认证测试重写** — 原密码/JWT 测试不再适用，重写为 NextAuth session + `ALLOWED_EMAILS` 白名单测试

### 5.3 测试文件最终分布

```
tests/
├── setup.ts                              ← 从 tests/setup.js 迁移 + 扩展
├── mocks/
│   ├── db-storage.ts                     ← Mock D1 client（参考 zhe 的 SQL 解释器模式）
│   └── auth.ts                           ← Mock NextAuth session
│
├── unit/                                 ← L1 单元测试
│   ├── models/                           ← 从原 tests/utils/ + tests/otp/ 迁移
│   │   ├── otp.test.ts                   ← 63 用例，RFC 向量
│   │   ├── encryption.test.ts            ← 24 用例
│   │   ├── validation.test.ts            ← 56 用例
│   │   ├── backup.test.ts               ← 51 用例
│   │   ├── import-parsers.test.ts        ← 新增，18+ 格式解析器
│   │   └── export-formatters.test.ts     ← 新增，17+ 格式生成器
│   ├── actions/                          ← Server Action 单元测试
│   │   ├── secrets.test.ts
│   │   ├── backup.test.ts
│   │   └── settings.test.ts
│   ├── viewmodels/                       ← ViewModel 层 (renderHook)
│   │   ├── useSecretsViewModel.test.ts
│   │   ├── useBackupViewModel.test.ts
│   │   ├── useToolsViewModel.test.ts
│   │   └── useSettingsViewModel.test.ts
│   └── lib/
│       └── logger.test.ts               ← 66 用例
│
├── components/                           ← L1 Component 层 UT
│   ├── SecretCard.test.tsx
│   ├── OtpDisplay.test.tsx
│   └── ImportExportDialog.test.tsx
│
├── api/                                  ← L3 API E2E（调用 Server Actions）
│   ├── auth.e2e.test.ts                  ← 重写（NextAuth session + 白名单）
│   ├── secrets.e2e.test.ts               ← 30 用例
│   ├── batch.e2e.test.ts                 ← 16 用例
│   └── backup.e2e.test.ts               ← 34 用例
│
├── playwright/                           ← L4 BDD E2E Playwright
│   ├── auth.spec.ts
│   ├── secrets-crud.spec.ts
│   ├── otp-generation.spec.ts
│   ├── import-export.spec.ts
│   └── backup-restore.spec.ts
│
└── fixtures/                             ← 从原项目完整保留
    ├── imports/                           ← 20 个导入格式文件
    └── exports/                           ← 17 个导出格式文件

worker/test/
├── router.test.ts                        ← 49 用例
├── otp.test.ts                           ← Worker OTP 端点
├── favicon.test.ts                       ← Worker Favicon 端点
├── rate-limit.test.ts                    ← 54 用例
├── rate-limit-sliding.test.ts            ← 12 用例
├── security.test.ts                      ← 44 用例
├── backup.test.ts                        ← Worker Cron 备份
└── utils/
    ├── response.test.ts                  ← 30 用例
    └── monitoring.test.ts                ← 79 用例
```

### 5.4 用例数量对比

| 类别 | 原项目 | 迁移保留 | 新增 | 合计 |
|------|--------|----------|------|------|
| Model UT (OTP/加密/验证/备份) | 194 | 194 | ~120 (import/export parsers) | ~314 |
| Lib UT (日志) | 66 | 66 | — | 66 |
| Worker UT (监控/响应/限流/安全/路由) | 268 | 268 | ~50 (otp/favicon/backup) | ~318 |
| Action UT | 0 | — | ~60 | ~60 |
| ViewModel UT | 0 | — | ~75 | ~75 |
| Component UT | 0 | — | ~45 | ~45 |
| API E2E (L3) | 111 | 80 | ~15 | ~95 |
| BDD E2E (L4) | 0 | — | ~35 | ~35 |
| **合计** | **~593** | **~593** | **~400** | **~983** |

---

## 六、原子化提交计划 {#commits}

每个 commit 仅含一个逻辑变更，确保可通过测试且可构建。

### Phase 1: 项目骨架 (18 commits)

| # | Commit | 内容 |
|---|--------|------|
| 1 | `chore: initialize next.js 15 project with bun` | package.json, tsconfig, next-env.d.ts |
| 2 | `feat: configure tailwind css 4 with hsl design tokens` | tailwind.config.ts, globals.css |
| 3 | `feat: initialize shadcn/ui component library` | components.json, lib/utils.ts, components/ui/* |
| 4 | `chore: configure eslint 9 flat config` | eslint.config.mjs |
| 5 | `test: configure vitest with jsdom and mock d1` | vitest.config.ts, tests/setup.ts, tests/mocks/ |
| 6 | `chore: configure husky pre-commit and pre-push hooks` | .husky/pre-commit, pre-push |
| 7 | `feat: create root layout with metadata and theme` | app/layout.tsx, app/page.tsx, app/not-found.tsx |
| 8 | `feat: add dark/light theme provider and toggle` | components/theme-*.tsx |
| 9 | `feat: configure i18next with english and chinese` | i18n/ |
| 10 | `feat: create single-source constants module` | models/constants.ts (fix P2) |
| 11 | `feat: define core application types` | models/types.ts |
| 12 | `feat: add version tracking and pwa manifest stub` | lib/version.ts, app/manifest.ts |
| 13 | `feat: add health and liveness api endpoints` | app/api/health/, app/api/live/ |
| 14 | `feat: design landing page with login button` | app/page.tsx（根路径 = 登录页，已登录则 redirect /dashboard） |
| 15 | `feat: scaffold dashboard route group with placeholders` | app/(dashboard)/ |
| 16 | `feat: create app sidebar with navigation` | components/app-sidebar.tsx |
| 17 | `feat: create dashboard shell wrapper` | components/dashboard-shell.tsx |
| 18 | `chore: finalize package scripts` | package.json scripts |

### Phase 2: 基础设施层 (13 commits)

| # | Commit | 内容 |
|---|--------|------|
| 19 | `feat: define d1 database schema with drizzle` | lib/db/schema.ts |
| 20 | `feat: generate initial d1 migration` | drizzle/, drizzle.config.ts |
| 21 | `feat: implement d1 http api client` | lib/db/d1-client.ts |
| 22 | `feat: create d1 row-to-type mappers` | lib/db/mappers.ts |
| 23 | `feat: implement scoped database with row-level security` | lib/db/scoped.ts |
| 24 | `feat: create db index with public functions` | lib/db/index.ts |
| 25 | `feat: configure nextauth v5 with google oauth` | auth.ts |
| 26 | `feat: implement custom d1 adapter for nextauth` | lib/auth-adapter.ts |
| 27 | `feat: create cached auth context helpers` | lib/auth-context.ts |
| 28 | `feat: implement auth middleware for dashboard routes` | middleware.ts |
| 29 | `feat: integrate google oauth login flow` | app/page.tsx 添加 Google signIn 按钮 |
| 30 | `feat: integrate auth into dashboard layout` | dashboard layout update |
| 31 | `test: add unit tests for infrastructure layer` | ~80 tests |

### Phase 3: Model 层 — TDD (13 commits) ✅

| # | Commit | 内容 | 状态 |
|---|--------|------|------|
| 32+33 | `feat: implement otp model with base32 codec and totp/hotp generation` | models/otp.ts (fix P1), 54 tests | ✅ |
| 34 | `feat: implement aes-gcm 256-bit encryption` | models/encryption.ts, 22 tests | ✅ |
| 35 | `feat: implement validation with schema system` | models/validation.ts, 69 tests | ✅ |
| 36+37 | `feat: implement import parser infrastructure and all format parsers` | models/import-parsers.ts, 15 formats, 43→66 tests | ✅ |
| 38+39 | `feat: implement export formatters for all supported formats` | models/export-formatters.ts, 12 formats, 23 tests | ✅ |
| 41 | `feat: implement backup model with hash, debounce, and retention` | models/backup.ts, 28 tests | ✅ |
| 42 | `feat: implement structured logger with null guard` | lib/logger.ts (fix P5), 24 tests | ✅ |
| 43 | `feat: implement typed error classes with factory` | models/errors.ts, 24 tests | ✅ |
| 44 | `test: consolidate model tests to 90%+ coverage` | 330 total tests, models 97% stmts | ✅ |

### Phase 4: Worker 后端 (10 commits)

| # | Commit | 内容 | Status |
|---|--------|------|--------|
| 45 | `feat: scaffold cloudflare worker project` | worker/package.json, wrangler.toml.example, src/index.ts | ✅ |
| 46 | `feat: implement worker request router` | worker/src/router.ts, utils/response.ts, 6 tests | ✅ |
| 47 | `feat: implement quick otp generation endpoint` | worker/src/otp.ts, 13 tests | ✅ |
| 48 | `feat: implement favicon proxy with waterfall sources` | worker/src/favicon.ts, 7 tests | ✅ |
| 49 | `feat: implement rate limiting with sliding window` | worker/src/rate-limit.ts, 18 tests | ✅ |
| 50 | `feat: implement unified security headers module` | worker/src/security.ts (fix P3), 16 tests | ✅ |
| 51 | `feat: implement cron daily backup via d1 binding` | worker/src/backup.ts, 16 tests | ✅ |
| 52 | `feat: integrate all worker modules into entry point` | rate limiting in router, 7 router tests | ✅ |
| 53 | `refactor: extract shared worker utilities` | worker/src/utils/crypto.ts, id.ts (fix P4), 11 tests | ✅ |
| 54 | `test: consolidate worker tests` | 88 total tests, 7 test files | ✅ |

### Phase 5: ViewModel + View 层 (20 commits)

| # | Commit | 内容 |
|---|--------|------|
| 55 | `feat: implement secret crud server actions` | actions/secrets.ts, ~25 tests |
| 56 | `feat: implement backup server actions` | actions/backup.ts, ~20 tests |
| 57 | `feat: implement settings server actions` | actions/settings.ts, ~15 tests |
| 58 | `feat: implement split state/actions dashboard context` | contexts/, ~15 tests |
| 59 | `feat: implement combined dashboard data fetch` | actions/dashboard.ts, ~5 tests |
| 60 | `feat: implement secrets viewmodel with otp generation` | viewmodels/useSecretsViewModel.ts, ~25 tests |
| 61 | `feat: implement backup viewmodel` | ~15 tests |
| 62 | `feat: implement developer tools viewmodel` | ~20 tests |
| 63 | `feat: implement settings viewmodel` | ~10 tests |
| 64 | `feat: implement auth viewmodel` | ~5 tests |
| 65 | `feat: implement secret list and card components` | ~20 tests |
| 66 | `feat: implement secret create/edit/delete modals` | ~15 tests |
| 67 | `feat: implement import and export dialogs` | ~15 tests |
| 68 | `feat: implement secrets management dashboard page` | wire it all |
| 69 | `feat: implement backup management page` | ~10 tests |
| 70 | `feat: wire backup page with server data` |  |
| 71 | `feat: implement developer tools page` | ~10 tests |
| 72 | `feat: wire tools page` |  |
| 73 | `feat: implement settings page` | ~8 tests |
| 74 | `feat: wire settings page and consolidate view tests` | ~253 total tests |

### Phase 6: PWA + 离线 (8 commits)

| # | Commit | 内容 |
|---|--------|------|
| 75 | `feat: configure serwist for pwa integration` | next.config.ts update |
| 76 | `feat: implement service worker with caching strategies` | app/sw.ts |
| 77 | `feat: configure complete pwa manifest` | app/manifest.ts |
| 78 | `feat: implement offline queue with indexeddb` | lib/offline-queue.ts, ~15 tests |
| 79 | `feat: implement background sync for offline operations` | ~10 tests |
| 80 | `feat: register web+otpauth protocol handler` | lib/protocol-handler.ts |
| 81 | `feat: create offline fallback page` | app/offline/ |
| 82 | `feat: add pwa install prompt component` |  |

### Phase 7: E2E 测试 + 部署 (10 commits)

| # | Commit | 内容 |
|---|--------|------|
| 83 | `test: configure api e2e test infrastructure` | tests/api/setup.ts |
| 84 | `test: add api e2e tests for secret crud` | ~30 tests |
| 85 | `test: add api e2e tests for backup operations` | ~15 tests |
| 86 | `test: add api e2e tests for auth and settings` | ~15 tests (fix P6) |
| 87 | `test: configure playwright e2e with auth setup` | playwright.config.ts, fixtures/ |
| 88 | `test: add playwright tests for auth flows` | ~8 tests |
| 89 | `test: add playwright tests for secrets management` | ~15 tests |
| 90 | `test: add playwright tests for backup, tools, settings` | ~12 tests |
| 91 | `chore: add dockerfile for railway deployment` | Dockerfile, .dockerignore |
| 92 | `docs: add deployment config, readme, and changelog` |  |

---

## 七、认证架构（NextAuth v5 + Google OAuth）

原项目使用密码 + JWT 认证。新项目替换为 **NextAuth v5 + Google OAuth**，基于 zhe 的 NextAuth 配置（Google Provider + JWT strategy + D1Adapter + Credentials E2E），neo 在此基础上**新增 `ALLOWED_EMAILS` 白名单访问控制**（zhe 没有此能力，因为 zhe 是公开注册服务）。

### 7.1 认证流程总览

```
┌──────────────────────────────────────────────────────────────┐
│                    浏览器 (Next.js SSR/CSR)                    │
│                                                               │
│  1. 用户点击 "Sign in with Google"                             │
│  2. NextAuth 跳转 Google OAuth Consent Screen                 │
│  3. Google 授权 → 回调 /api/auth/callback/google               │
│  4. NextAuth 创建 JWT session → HttpOnly Cookie                │
│  5. 后续请求自动携带 cookie，Server Actions 直接读取 session      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 NextAuth 配置

| 配置项 | 值 | 说明 |
|--------|---|------|
| Provider | Google OAuth | 标准 OAuth 2.0 流程 |
| Strategy | JWT | 避免每次请求查询 D1 session 表 |
| Adapter | 自定义 D1Adapter | 用 `executeD1Query` 操作 NextAuth 标准表 |
| Session | HttpOnly Cookie | 防 XSS，无 localStorage 泄露风险 |
| Credentials | 仅 `PLAYWRIGHT=1` | E2E 测试用，生产禁用 |

**环境变量**：

| 变量 | 说明 |
|------|------|
| `AUTH_SECRET` | NextAuth 签名密钥 |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |
| `AUTH_URL` | 应用 URL (Railway 域名) |
| `ALLOWED_EMAILS` | 逗号分隔的允许登录邮箱列表 |

### 7.3 auth-context.ts — Server Action 认证入口

```typescript
// lib/auth-context.ts — 参考 zhe 的实现

export const getSession = cache(() => auth());  // React.cache() 去重

export async function getScopedDB(): Promise<ScopedDB | null> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  return new ScopedDB(userId);
}

export async function getAuthContext() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  return { db: new ScopedDB(userId), userId };
}
```

### 7.4 Server Action 标准模式

```typescript
// actions/secrets.ts

'use server';

export async function createSecret(input: CreateSecretInput): Promise<ActionResult<Secret>> {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return { success: false, error: 'Unauthorized' };
    const { db } = ctx;

    // validation → business logic → db write
    return { success: true, data: secret };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create secret'
    };
  }
}
```

### 7.5 ALLOWED_EMAILS 白名单（neo 新增，zhe 无此策略）

zhe 是公开注册服务，任何 Google 账号都能登录。neo 是个人 2FA 管理器，必须限制为特定邮箱。这是 neo 新增的 `signIn` callback，不在 zhe 模板中：

```typescript
callbacks: {
  async signIn({ user }) {
    // neo 新增：白名单访问控制（zhe 无此回调）
    const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    return allowed.includes(user.email?.toLowerCase() ?? '');
  },
}
```

### 7.6 与原项目认证的对比

| 维度 | 原项目 | 新项目 |
|------|--------|--------|
| 登录方式 | 密码表单 | Google OAuth (NextAuth v5) |
| 密码存储 | PBKDF2 100K iterations 哈希存 KV | 无密码存储 |
| 会话 | 手工 JWT + HttpOnly Cookie | NextAuth JWT + HttpOnly Cookie |
| API 认证 | Cookie 中的 JWT | Server Actions 直接读 session (零 fetch) |
| 白名单 | 无（单用户靠密码） | `ALLOWED_EMAILS` 邮箱白名单 |
| Token 验证 | 自签 JWT 本地验证 | NextAuth 管理，Google OAuth 标准流程 |
| 首次设置 | `/setup` 页面设置密码 | 无需设置，第一次 Google 登录即可 |
| XSS 风险 | HttpOnly Cookie (安全) | HttpOnly Cookie (安全) |

### 7.7 移除的模块

以下原项目模块在新架构中**不再需要**：

| 原模块 | 原用途 | 替代方案 |
|--------|--------|----------|
| `src/utils/auth.js` 中的 `hashPassword/verifyPassword` | PBKDF2 密码哈希 | Google OAuth，无密码 |
| `src/utils/auth.js` 中的 `generateJWT/verifyJWT` | 自签 JWT | NextAuth 管理 session |
| `src/utils/auth.js` 中的 `handleFirstTimeSetup` | 首次设置密码 | 无需，首次 Google 登录即可 |
| `src/utils/auth.js` 中的 `handleLogin` | 密码登录 | NextAuth Google callback |
| `src/utils/auth.js` 中的 `handleRefreshToken` | JWT 续期 | NextAuth 自动管理 |
| `POST /api/setup` | 设置密码端点 | 移除 |
| `POST /api/login` | 密码登录端点 | 移除 |
| `POST /api/refresh-token` | Token 刷新端点 | 移除 |
| `GET /setup` | 首次设置页面 | 移除 |
| Rate Limit `login` 预设 | 密码暴力破解防护 | 不再需要（Google 自带防护） |
| `lib/api.ts` (fetch wrapper) | 前端调 Worker REST API | Server Actions 直接调 D1，无需 fetch |

### 7.8 对测试的影响

| 原测试文件 | 用例数 | 影响 |
|------------|--------|------|
| `auth.test.js` (密码哈希/JWT) | 54 | **移除**：密码/JWT 测试不再适用 |
| `auth.integration.test.js` (登录全链路) | 31 | **重写**：改为 NextAuth session + 白名单验证 |
| `handler.test.js` (路由) | 49 | **适配**：移除 `/api/setup`, `/api/login`, `/api/refresh-token` 路由测试 |
| `rateLimit.test.js` | 54 | **保留**：`login` 预设测试移除，其他不变 |

**新增测试**：

| 测试 | 内容 |
|------|------|
| `tests/api/auth.e2e.test.ts` | NextAuth session 验证、ALLOWED_EMAILS 白名单拒绝、无 session 401 |
| `tests/playwright/auth.spec.ts` | Google 登录 → 跳转 dashboard、白名单外邮箱被拒、登出（Credentials provider mock） |

---

## 八、与原 Vite SPA 方案的关键差异

本节总结从 Vite SPA 方案迁移到 Next.js 方案的核心变更，便于理解架构决策。

| 维度 | 原 Vite SPA 方案 | 当前 Next.js 方案 |
|------|------------------|-------------------|
| **框架** | Vite 7 + React Router 7 | Next.js 15 App Router |
| **渲染** | 纯 CSR (SPA) | SSR 初始加载 + CSR hydrate |
| **数据获取** | `fetch('/api/secrets')` → Worker REST | `'use server'` Server Actions → D1 HTTP |
| **存储** | Cloudflare KV (JSON blob) | Cloudflare D1 (关系型 schema + ScopedDB) |
| **认证** | Google GSI 前端 SDK + Worker 验证 id_token | NextAuth v5 + Google OAuth + HttpOnly Cookie |
| **路由守卫** | React Router `loader` + redirect | Next.js `middleware.ts` edge 级拦截 |
| **部署** | Cloudflare Pages (SPA) + Workers (API) | Railway (Next.js standalone) + Cloudflare (Worker) |
| **PWA** | 手工 Service Worker | Serwist (集成 Next.js build pipeline) |
| **Worker 职责** | 全部 API (CRUD/Auth/Backup) | 仅边缘任务 (Quick OTP/Favicon/Cron) |

---

## 九、版本管理

- **版本号来源**：`package.json` (单一事实来源)
- **显示位置**：Sidebar badge (`v0.1.0`), `/api/live` 返回
- **初始版本**：`0.1.0`
- **迭代规则**：默认 Z+1; 改动 > 500 行或间隔 > 3 天则 Y+1, Z 置 0
- **发布流程**：更新 package.json → CHANGELOG → commit → tag `vX.Y.Z` → GitHub Release

---

## 十、验证检查点

每个 Phase 完成后执行：

1. `bun run test:unit:coverage` — ≥90% 覆盖率门禁
2. `bun run lint` — 零警告
3. `bun run build` — 构建成功
4. Phase 7 完成后额外：`bun run test:api` + `bun run test:e2e:pw` 全量通过
