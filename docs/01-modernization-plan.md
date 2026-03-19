# 01 - 2FA Manager Modernization Plan

## 目标

将参考项目 `../2fa`（Cloudflare Worker 全栈 2FA 管理器）进行现代化改造，基于 basalt 模板体系重建，同时保留全部业务功能。

三大核心目标：

1. **框架现代化** — 从无框架模板字符串迁移到 React + TypeScript + MVVM
2. **UI 替换** — 用 basalt 模板体系（shadcn/ui + Tailwind CSS 4 + 设计 token）重建全部界面
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
| **认证** | PBKDF2 100K iterations 密码哈希 + JWT(HS256, 30 天) + HttpOnly Cookie |
| **加密存储** | AES-GCM 256-bit，格式 `v1:<iv>:<ciphertext>`，可选开启，自动检测 |
| **备份** | 事件驱动（防抖 5 分钟）+ Cron 定时（每日 UTC 16:00），保留最新 100 个 |
| **PWA** | Service Worker, 离线队列 (IndexedDB), Background Sync, Protocol handler |
| **限流** | 滑动窗口（默认）+ 固定窗口，5 种预设策略 |
| **Favicon 代理** | 瀑布尝试 4 个源，解决国内 Google 不可用 |
| **开发者工具** | QR 编解码, Base32 编解码, 密钥强度检查, 随机密钥生成, TOTP 时间步长可视化 |
| **日志 & 监控** | 结构化 5 级日志, Sentry 集成(可选), 性能追踪 |

### 1.3 已知问题（迁移中修复）

| 编号 | 问题 | 修复方案 |
|------|------|----------|
| P1 | `generateTOTP` vs `generateOTP` counter 写入不一致（低 32 位 vs 64 位） | 统一为 64 位写入 |
| P2 | 常量重复硬编码（`constants.js` vs `auth.js` 各自定义 `PBKDF2_ITERATIONS`） | 单一来源 `constants.ts` |
| P3 | `errorToResponse` 内联 CORS `*`，与 `security.js` 动态同源策略矛盾 | 统一通过 security 模块 |
| P4 | `worker.js` ↔ `shared.js` 循环依赖 | `generateDataHash/saveDataHash` 移入 `utils/` |
| P5 | `logger.info('Test', null)` 抛 TypeError | 添加 null guard |
| P6 | auth.js 未导出内部函数，测试复制实现代码 | 导出函数，直接测试 |

---

## 二、目标技术栈

| 维度 | 目标 | 来源 |
|------|------|------|
| **运行时** | Bun | basalt 模板 |
| **构建** | Vite 7 + SWC | basalt 模板 |
| **UI 框架** | React 19 + TypeScript (strict) | basalt 模板 |
| **路由** | React Router 7 (BrowserRouter) | basalt 模板 |
| **样式** | Tailwind CSS 4 + CSS 变量设计 token | basalt 模板 |
| **组件库** | shadcn/ui (Radix UI) | basalt 模板 |
| **图标** | Lucide React (1.5px strokeWidth) | basalt 模板 |
| **i18n** | i18next + react-i18next | basalt 模板 |
| **Toast** | Sonner | basalt 模板 |
| **架构** | MVVM (Model → ViewModel → View) | basalt 模板 |
| **主题** | 3 态 (system/light/dark) + HSL token | basalt 模板 |
| **测试** | Vitest 4 + @testing-library/react + Playwright | basalt + 新增 |
| **Lint** | ESLint 9 (flat config) + typescript-eslint (strict) | basalt 模板 |
| **Git hooks** | Husky 9 | basalt 模板 |
| **后端** | Cloudflare Workers + KV | 原项目保留 |
| **部署** | Cloudflare Pages (前端 SPA) + Workers (API) | 架构升级 |

---

## 三、架构设计

### 3.1 MVVM 分层

```
┌─────────────────────────────────────────────────────────────┐
│                         View (Pages)                        │
│  LoginPage / SetupPage / DashboardPage / ToolsPage / ...    │
│  纯展示，只调用 useXxxViewModel() hook                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ 消费
┌──────────────────────────▼──────────────────────────────────┐
│                    ViewModel (Hooks)                         │
│  useSecretsViewModel / useOtpViewModel / useBackupViewModel │
│  useMemo 组合 model + API 数据，返回 view-ready 数据          │
└──────────────────────────┬──────────────────────────────────┘
                           │ 调用
┌──────────────────────────▼──────────────────────────────────┐
│                      Model (Pure TS)                        │
│  otp/generator.ts / encryption.ts / validation.ts / ...     │
│  零 React 依赖，纯函数 + 类型定义                              │
└─────────────────────────────────────────────────────────────┘
```

**核心原则**：

- **Model** — 零 React 依赖，纯函数 + TypeScript 接口，所有业务逻辑在此层
- **ViewModel** — React hooks，用 `useMemo` 组合 model + API 数据，返回 View-ready 结构
- **View** — 纯展示，只消费 ViewModel hooks，从不直接导入 model 或 API

### 3.2 目录结构

```
neo/
├── src/
│   ├── main.tsx                    ← Entry: theme flash 防止, i18n init
│   ├── App.tsx                     ← 路由定义
│   ├── index.css                   ← Tailwind 4 + 设计 token
│   │
│   ├── models/                     ← 纯业务逻辑 (零 React 依赖)
│   │   ├── types.ts                ← 共享接口 (Secret, OTPConfig, Backup...)
│   │   ├── otp.ts                  ← TOTP/HOTP 生成算法 (Web Crypto)
│   │   ├── encryption.ts           ← AES-GCM 加解密
│   │   ├── validation.ts           ← Schema 验证 + Base32 校验
│   │   ├── auth.ts                 ← PBKDF2 哈希 + JWT 生成/验证
│   │   ├── backup.ts               ← 备份管理逻辑
│   │   ├── import-parsers.ts       ← 18+ 导入格式解析器
│   │   ├── export-formatters.ts    ← 17+ 导出格式生成器
│   │   └── constants.ts            ← 集中常量 (单一来源)
│   │
│   ├── viewmodels/                 ← React hooks (组合 model + API)
│   │   ├── useSecretsViewModel.ts  ← 密钥列表 + CRUD
│   │   ├── useOtpViewModel.ts      ← OTP 生成 + 倒计时
│   │   ├── useAuthViewModel.ts     ← 登录/设置/会话状态
│   │   ├── useBackupViewModel.ts   ← 备份列表 + 创建/恢复
│   │   ├── useImportViewModel.ts   ← 导入流程
│   │   ├── useExportViewModel.ts   ← 导出流程
│   │   ├── useSearchViewModel.ts   ← 搜索过滤
│   │   └── useToolsViewModel.ts    ← 开发者工具
│   │
│   ├── pages/                      ← View 层
│   │   ├── LoginPage.tsx           ← 登录页（独立，无 sidebar）
│   │   ├── SetupPage.tsx           ← 首次设置页
│   │   ├── DashboardPage.tsx       ← 密钥列表 + OTP 显示（主页面）
│   │   ├── BackupPage.tsx          ← 备份管理
│   │   ├── ToolsPage.tsx           ← 开发者工具集
│   │   ├── SettingsPage.tsx        ← 设置（主题、密码、加密）
│   │   └── NotFound.tsx            ← 404
│   │
│   ├── components/
│   │   ├── DashboardLayout.tsx     ← 主布局: sidebar + header + Outlet
│   │   ├── AppSidebar.tsx          ← 侧边栏导航
│   │   ├── ThemeToggle.tsx         ← 三态主题切换
│   │   ├── LanguageToggle.tsx      ← i18n 切换
│   │   ├── SecretCard.tsx          ← 单个密钥卡片 (Logo + OTP + 倒计时)
│   │   ├── OtpDisplay.tsx          ← OTP 显示 + 复制
│   │   ├── CountdownRing.tsx       ← TOTP 倒计时环
│   │   ├── QrScanner.tsx           ← QR 码扫描
│   │   ├── ImportDialog.tsx        ← 导入对话框
│   │   ├── ExportDialog.tsx        ← 导出对话框
│   │   └── ui/                     ← shadcn/ui 原语
│   │
│   ├── lib/
│   │   ├── utils.ts                ← cn() = clsx + tailwind-merge
│   │   ├── api.ts                  ← API 客户端 (fetch wrapper)
│   │   └── palette.ts              ← 图表调色板
│   │
│   ├── hooks/
│   │   └── use-mobile.tsx          ← 响应式断点 hook
│   │
│   ├── i18n/
│   │   ├── index.ts                ← i18next 初始化
│   │   └── locales/
│   │       ├── en.json
│   │       └── zh.json
│   │
│   └── test/                       ← 四层测试
│       ├── setup.ts                ← jest-dom + polyfills + i18n
│       ├── models/                 ← L1: 纯逻辑单元测试
│       ├── viewmodels/             ← L1: hook 测试 (renderHook)
│       ├── components/             ← L1: 组件 DOM 测试
│       ├── pages/                  ← L1: 页面冒烟测试
│       ├── api/                    ← L3: API E2E 测试
│       └── e2e/                    ← L4: BDD E2E (Playwright)
│
├── worker/                         ← Cloudflare Worker 后端
│   ├── src/
│   │   ├── index.ts                ← Worker 入口 (fetch + scheduled)
│   │   ├── router.ts               ← API 路由分发
│   │   ├── api/
│   │   │   ├── secrets.ts          ← 密钥 CRUD
│   │   │   ├── batch.ts            ← 批量导入
│   │   │   ├── backup.ts           ← 备份 API
│   │   │   ├── restore.ts          ← 恢复 + 导出
│   │   │   ├── auth.ts             ← 登录/设置/刷新
│   │   │   └── favicon.ts          ← Favicon 代理
│   │   ├── middleware/
│   │   │   ├── auth.ts             ← JWT 验证中间件
│   │   │   ├── rate-limit.ts       ← 限流中间件
│   │   │   └── cors.ts             ← CORS 中间件
│   │   └── utils/
│   │       ├── encryption.ts       ← AES-GCM (复用 models/)
│   │       ├── security.ts         ← 安全头
│   │       ├── response.ts         ← 标准化响应
│   │       ├── errors.ts           ← 错误层次
│   │       ├── logger.ts           ← 结构化日志
│   │       ├── monitoring.ts       ← Sentry + 性能追踪
│   │       └── backup-manager.ts   ← 备份调度
│   └── test/                       ← Worker 单元测试
│
├── docs/                           ← 编号文档
│   ├── README.md
│   └── 01-modernization-plan.md    ← 本文档
│
├── CLAUDE.md
├── CHANGELOG.md
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── wrangler.toml
├── tsconfig.json
├── eslint.config.js
├── .prettierrc
└── .husky/
    ├── pre-commit                  ← bun run test + bun run lint (覆盖率 ≥ 90%)
    └── pre-push                    ← bun run test:api-e2e
```

### 3.3 前后端分离

原项目将前后端混在一个 Worker 中。新架构拆分为：

| 层 | 部署目标 | 说明 |
|---|---|---|
| **前端 SPA** | Cloudflare Pages | Vite 构建 → `dist/`，SPA fallback |
| **API Worker** | Cloudflare Workers | RESTful API + KV 存储 + Cron 备份 |

前端通过 `lib/api.ts` fetch wrapper 调用 Worker API。开发时 Vite proxy 转发 `/api/*` 到 Worker dev server。

---

## 四、四层测试架构

综合利用 **UT + Lint + API E2E + BDD E2E** 四层验证结构，自主、尽早发现问题，避免问题积累。

### 4.1 层级定义

| 层级 | 名称 | 要求 | 工具 |
|------|------|------|------|
| **L1: UT** | 单元测试 | 覆盖率 **≥ 90%** | Vitest 4 + @testing-library/react |
| **L2: Lint** | 代码检查 | 错误、警告 **0 容忍**，strict 模式 | ESLint 9 + typescript-eslint |
| **L3: API E2E** | 接口端到端 | **100%** RESTful API 覆盖 | Vitest + fetch against dev server |
| **L4: BDD E2E** | 行为驱动端到端 | 核心主干流程 | Playwright |

### 4.2 UT 分层（L1 内部细分）

对应 MVVM 架构，UT 进一步分为四个子层：

| 子层 | 目录 | 测什么 | 特点 |
|------|------|--------|------|
| **Model** | `test/models/` | 纯函数：OTP 生成、加解密、验证、解析器 | 零 React、零 mock、最快最稳 |
| **ViewModel** | `test/viewmodels/` | React hooks 输出形状和计算 | `renderHook()` |
| **Component** | `test/components/` | UI 组件 DOM 输出 | 传 props → 验证渲染 |
| **Page** | `test/pages/` | 页面级冒烟测试 | `vi.mock` viewmodel，只验证不崩 |

### 4.3 API E2E 测试矩阵（L3）

| 端点 | 方法 | 测试场景 |
|------|------|----------|
| `POST /api/setup` | POST | 首次设置密码、密码强度校验、重复设置拒绝 |
| `POST /api/login` | POST | 正确/错误密码、限流、JWT 返回 |
| `POST /api/refresh-token` | POST | 有效/过期/篡改 token |
| `GET /api/secrets` | GET | 空列表、有数据、加密数据 |
| `POST /api/secrets` | POST | 添加密钥、重复检测、弱密钥警告 |
| `PUT /api/secrets/:id` | PUT | 更新、不存在的 ID |
| `DELETE /api/secrets/:id` | DELETE | 删除、限流(sensitive) |
| `POST /api/secrets/batch` | POST | 批量导入、上限 100、部分失败 |
| `GET /api/backup` | GET | 备份列表、分页、空列表 |
| `POST /api/backup` | POST | 创建备份、限流 |
| `POST /api/backup/restore` | POST | 恢复、预览模式 |
| `GET /api/backup/export/:key` | GET | 导出 txt/json/csv |
| `GET /api/favicon/:domain` | GET | 正常域名、不存在域名、超时 |
| `GET /otp/:secret` | GET | 有效密钥、无效密钥 |

### 4.4 BDD E2E 核心流程（L4）

| 流程 | 步骤 |
|------|------|
| **首次设置** | 打开应用 → 设置密码 → 跳转主页 |
| **登录** | 打开应用 → 输入密码 → 看到密钥列表 |
| **添加密钥** | 登录 → 添加密钥表单 → 填写 → 保存 → 列表中出现 |
| **OTP 生成** | 登录 → 查看密钥 → OTP 显示 + 倒计时 → 复制 |
| **导入导出** | 登录 → 导入文件 → 预览 → 确认 → 验证数据 → 导出 → 验证文件 |
| **备份恢复** | 登录 → 创建备份 → 删除密钥 → 恢复备份 → 验证数据 |

### 4.5 自动化触发 (Husky)

| 阶段 | 命令 | 内容 |
|------|------|------|
| **pre-commit** | `bun run test && bun run lint` | UT + Lint，覆盖率 < 90% 则 Fail |
| **pre-push** | `bun run test:api-e2e` | API E2E，确保 API 协议没有被伤害 |
| **手动** | `bun run test:e2e` | BDD E2E (Playwright)，按需运行 |

### 4.6 E2E 服务器约定

| 用途 | 端口 | 说明 |
|------|------|------|
| Dev Server (前端) | 7021 | Vite dev server |
| Worker Dev Server (API) | 8787 | `wrangler dev` 默认端口 |
| API E2E Server | 17021 | 独立实例，`E2E_SKIP_AUTH=1` |
| BDD E2E Server | 27021 | Playwright 专用实例 |

- 运行前脚本检查端口占用，已占用则先清理
- `E2E_SKIP_AUTH=1` + `NODE_ENV=development` 绕开登录

---

## 五、原项目测试保留计划

原项目共 ~593 个测试用例，全部保留并迁移到 TypeScript。下表列出每个测试文件的迁移策略。

### 5.1 测试清单与迁移映射

| 原文件 | 用例数 | 迁移目标 | 迁移策略 |
|--------|--------|----------|----------|
| `tests/setup.js` | — | `src/test/setup.ts` | 重写为 TS；Web Crypto polyfill 保留，新增 jest-dom + matchMedia + i18n |
| `tests/otp/generator.test.js` | ~63 | `src/test/models/otp.test.ts` | **直接迁移**，RFC 6238/4226 测试向量全部保留，修复 P1 (counter 64 位统一) |
| `tests/utils/encryption.test.js` | 24 | `src/test/models/encryption.test.ts` | **直接迁移**，AES-GCM 往返测试、篡改检测、IV 随机性全部保留 |
| `tests/utils/validation.test.js` | 56 | `src/test/models/validation.test.ts` | **直接迁移**，Base32 校验、OTP 参数验证、密钥强度、排序、重复检测全部保留 |
| `tests/utils/auth.test.js` | 54 | `src/test/models/auth.test.ts` | **迁移并修复 P6**：不再复制生产代码，改为直接 import 导出函数测试 |
| `tests/utils/auth.integration.test.js` | 31 | `src/test/api/auth.e2e.test.ts` | **迁移为 L3 API E2E**：首次设置→登录→访问→刷新全链路保留 |
| `tests/utils/backup.test.js` | 51 | `src/test/models/backup.test.ts` | **直接迁移**，防抖机制、加密/明文备份、自动清理、性能指标全部保留 |
| `tests/utils/logger.test.js` | 66 | `worker/test/utils/logger.test.ts` | **直接迁移**，5 级日志、脱敏、PerformanceTimer、请求中间件全部保留；修复 P5 (null data) |
| `tests/utils/monitoring.test.js` | ~79 | `worker/test/utils/monitoring.test.ts` | **直接迁移**，ErrorMonitor/PerformanceMonitor/MonitoringManager、Sentry 集成全部保留 |
| `tests/utils/rateLimit.test.js` | 54 | `worker/test/middleware/rate-limit.test.ts` | **直接迁移**，固定窗口算法、5 种预设、withRateLimit 中间件、客户端识别全部保留 |
| `tests/utils/rateLimitSlidingWindow.test.js` | 12 | `worker/test/middleware/rate-limit-sliding.test.ts` | **直接迁移**，滑动窗口、窗口边界攻击防护（关键安全测试）全部保留 |
| `tests/utils/response.test.js` | 30 | `worker/test/utils/response.test.ts` | **直接迁移**，JSON/Error/Success/HTML 四种响应、安全头全部保留 |
| `tests/utils/security.test.js` | 44 | `worker/test/middleware/security.test.ts` | **直接迁移**，CORS 同源判断、CSP、预检请求、IPv6、localhost 互通全部保留 |
| `tests/api/secrets.test.js` | 30 | `src/test/api/secrets.e2e.test.ts` | **迁移为 L3 API E2E**：CRUD 全流程、加密透明性全部保留 |
| `tests/api/batch.test.js` | 16 | `src/test/api/batch.e2e.test.ts` | **迁移为 L3 API E2E**：批量导入、部分失败、大批量全部保留 |
| `tests/api/backup.test.js` | 34 | `src/test/api/backup.e2e.test.ts` | **迁移为 L3 API E2E**：备份创建/列表/恢复/导出(TXT/JSON/CSV)全部保留 |
| `tests/router/handler.test.js` | 49 | `worker/test/router.test.ts` | **直接迁移**，路由分发、认证检查、405/404、CORS 预检全部保留 |

### 5.2 迁移原则

1. **用例数量不减少** — 原有 ~593 个用例全部保留，只增不减
2. **JS → TS** — 所有测试文件从 `.js` 迁移到 `.ts`/`.tsx`，添加类型标注
3. **MockKV 升级** — 原项目手工 MockKV 类统一提取为 `src/test/helpers/mock-kv.ts`，增加 TTL 过期模拟
4. **RFC 向量不改** — OTP 的 RFC 6238/4226 官方测试向量原封不动保留
5. **安全测试不改** — 滑动窗口边界攻击防护、JWT 篡改检测、AES-GCM 完整性校验原封不动保留
6. **已知 bug 修复后更新断言** — P5 (logger null data) 修复后，测试从"验证抛异常"改为"验证正常处理"
7. **P6 修复** — `auth.test.ts` 不再复制生产代码，改为直接 import 测试

### 5.3 测试文件最终分布

迁移完成后的测试目录结构：

```
src/test/
├── setup.ts                              ← 从 tests/setup.js 迁移 + 扩展
├── helpers/
│   ├── mock-kv.ts                        ← 统一 MockKV 类（从各测试文件提取合并）
│   ├── mock-env.ts                       ← createMockEnv() 工厂
│   └── mock-request.ts                   ← createMockRequest() 工厂
│
├── models/                               ← L1 Model 层 UT（从原 tests/utils/ + tests/otp/ 迁移）
│   ├── otp.test.ts                       ← 63 用例，RFC 向量
│   ├── encryption.test.ts                ← 24 用例
│   ├── validation.test.ts                ← 56 用例
│   ├── auth.test.ts                      ← 54 用例（修复 P6，直接 import）
│   ├── backup.test.ts                    ← 51 用例
│   ├── import-parsers.test.ts            ← 新增，用原项目 20 个 fixture 文件编写
│   └── export-formatters.test.ts         ← 新增，用原项目 17 个 fixture 文件编写
│
├── viewmodels/                           ← L1 ViewModel 层 UT（全部新增）
│   ├── useAuthViewModel.test.ts
│   ├── useSecretsViewModel.test.ts
│   ├── useOtpViewModel.test.ts
│   ├── useBackupViewModel.test.ts
│   ├── useImportViewModel.test.ts
│   ├── useExportViewModel.test.ts
│   ├── useSearchViewModel.test.ts
│   └── useToolsViewModel.test.ts
│
├── components/                           ← L1 Component 层 UT（全部新增）
│   ├── SecretCard.test.tsx
│   ├── OtpDisplay.test.tsx
│   ├── CountdownRing.test.tsx
│   └── QrScanner.test.tsx
│
├── pages/                                ← L1 Page 层冒烟测试（全部新增）
│   ├── LoginPage.test.tsx
│   ├── SetupPage.test.tsx
│   ├── DashboardPage.test.tsx
│   ├── BackupPage.test.tsx
│   ├── ToolsPage.test.tsx
│   └── SettingsPage.test.tsx
│
├── api/                                  ← L3 API E2E（从原 tests/api/ + auth.integration 迁移）
│   ├── auth.e2e.test.ts                  ← 31 用例（从 auth.integration.test.js）
│   ├── secrets.e2e.test.ts               ← 30 用例
│   ├── batch.e2e.test.ts                 ← 16 用例
│   ├── backup.e2e.test.ts                ← 34 用例
│   ├── favicon.e2e.test.ts               ← 新增
│   └── otp.e2e.test.ts                   ← 新增
│
├── e2e/                                  ← L4 BDD E2E Playwright（全部新增）
│   ├── setup-flow.spec.ts
│   ├── login-flow.spec.ts
│   ├── secrets-crud.spec.ts
│   ├── otp-generation.spec.ts
│   ├── import-export.spec.ts
│   └── backup-restore.spec.ts
│
└── fixtures/                             ← 从原 tests/fixtures/ 完整保留
    ├── imports/                           ← 20 个导入格式文件
    └── exports/                           ← 17 个导出格式文件

worker/test/
├── router.test.ts                        ← 49 用例（从 tests/router/handler.test.js）
├── utils/
│   ├── logger.test.ts                    ← 66 用例
│   ├── monitoring.test.ts                ← 79 用例
│   └── response.test.ts                  ← 30 用例
└── middleware/
    ├── rate-limit.test.ts                ← 54 用例
    ├── rate-limit-sliding.test.ts        ← 12 用例
    └── security.test.ts                  ← 44 用例
```

### 5.4 用例数量对比

| 类别 | 原项目 | 迁移保留 | 新增 | 合计 |
|------|--------|----------|------|------|
| Model UT (OTP/加密/验证/认证/备份) | 248 | 248 | ~120 (import/export parsers) | ~368 |
| Worker UT (日志/监控/响应/限流/安全/路由) | 334 | 334 | — | 334 |
| ViewModel UT | 0 | — | ~64 | ~64 |
| Component UT | 0 | — | ~32 | ~32 |
| Page 冒烟测试 | 0 | — | ~24 | ~24 |
| API E2E (L3) | 11 (auth integration) | 111 | ~20 (favicon/otp) | ~131 |
| BDD E2E (L4) | 0 | — | ~30 | ~30 |
| **合计** | **~593** | **~593** | **~290** | **~983** |

---

## 六、原子化提交计划 {#commits}

每个 commit 仅含一个逻辑变更，确保可通过测试且可构建。

### Phase 1: 项目骨架

| # | Commit | 内容 |
|---|--------|------|
| 1 | `chore: initialize project with bun and vite` | `bun init`, Vite 7 + SWC, tsconfig (strict), 基础 `package.json` |
| 2 | `chore: add tailwind css 4 and design tokens` | Tailwind 4, `index.css` 设计 token (HSL 3 层亮度), shadcn/ui 初始化 |
| 3 | `chore: add eslint 9 and prettier` | ESLint flat config + typescript-eslint (strict), Prettier, `.editorconfig` |
| 4 | `chore: add vitest and testing infrastructure` | Vitest config, test setup, `@testing-library/react`, jsdom |
| 5 | `chore: add husky pre-commit and pre-push hooks` | Husky 9, pre-commit (test + lint), pre-push (API E2E) |
| 6 | `chore: add i18n with english and chinese` | i18next, browser-languagedetector, en.json / zh.json 骨架 |
| 7 | `chore: add react router and layout components` | React Router 7, DashboardLayout, AppSidebar, ThemeToggle |

### Phase 2: Model 层（纯逻辑，TDD）

| # | Commit | 内容 |
|---|--------|------|
| 8 | `feat: add types and constants` | `models/types.ts` + `models/constants.ts`，单一常量来源 |
| 9 | `feat: add otp generator model with rfc test vectors` | `models/otp.ts` + `test/models/otp.test.ts`，TOTP/HOTP, SHA-1/256/512 |
| 10 | `feat: add encryption model` | `models/encryption.ts` + test，AES-GCM 256-bit |
| 11 | `feat: add validation model` | `models/validation.ts` + test，Base32, 密码强度, Schema |
| 12 | `feat: add auth model` | `models/auth.ts` + test，PBKDF2, JWT，修复 P6 |
| 13 | `feat: add import parsers model` | `models/import-parsers.ts` + test，18+ 格式 |
| 14 | `feat: add export formatters model` | `models/export-formatters.ts` + test，17+ 格式 |
| 15 | `feat: add backup model` | `models/backup.ts` + test |

### Phase 3: Worker 后端

| # | Commit | 内容 |
|---|--------|------|
| 16 | `feat: add worker entry and router` | `worker/src/index.ts` + `router.ts`，修复 P4 循环依赖 |
| 17 | `feat: add auth api endpoints` | setup / login / refresh-token |
| 18 | `feat: add secrets crud api` | GET/POST/PUT/DELETE /api/secrets |
| 19 | `feat: add batch import api` | POST /api/secrets/batch |
| 20 | `feat: add backup and restore api` | backup CRUD + restore + export |
| 21 | `feat: add favicon proxy api` | /api/favicon/:domain |
| 22 | `feat: add rate limiting middleware` | 滑动窗口 + 5 种预设 |
| 23 | `feat: add security middleware` | CORS + CSP + 安全头，修复 P3 |
| 24 | `feat: add scheduled backup handler` | Cron 定时备份 + 数据哈希变更检测 |
| 25 | `feat: add logger and monitoring` | 结构化日志 + Sentry 集成，修复 P5 |

### Phase 4: ViewModel 层

| # | Commit | 内容 |
|---|--------|------|
| 26 | `feat: add auth viewmodel` | `useAuthViewModel` + test |
| 27 | `feat: add secrets viewmodel` | `useSecretsViewModel` + test |
| 28 | `feat: add otp viewmodel with countdown` | `useOtpViewModel` + test |
| 29 | `feat: add backup viewmodel` | `useBackupViewModel` + test |
| 30 | `feat: add import and export viewmodels` | `useImportViewModel` + `useExportViewModel` + test |
| 31 | `feat: add search viewmodel` | `useSearchViewModel` + test |
| 32 | `feat: add tools viewmodel` | `useToolsViewModel` + test |

### Phase 5: View 层（页面 + 组件）

| # | Commit | 内容 |
|---|--------|------|
| 33 | `feat: add login and setup pages` | LoginPage, SetupPage + 冒烟测试 |
| 34 | `feat: add dashboard page with secret cards` | DashboardPage, SecretCard, OtpDisplay, CountdownRing |
| 35 | `feat: add import and export dialogs` | ImportDialog, ExportDialog |
| 36 | `feat: add backup page` | BackupPage |
| 37 | `feat: add tools page` | ToolsPage (QR, Base32, KeyGen, etc.) |
| 38 | `feat: add settings page` | SettingsPage (主题, 密码修改, 加密配置) |
| 39 | `feat: add pwa support` | Service Worker, manifest, 离线队列 |

### Phase 6: E2E 测试

| # | Commit | 内容 |
|---|--------|------|
| 40 | `test: add api e2e tests for auth endpoints` | L3 测试 |
| 41 | `test: add api e2e tests for secrets endpoints` | L3 测试 |
| 42 | `test: add api e2e tests for backup endpoints` | L3 测试 |
| 43 | `test: add bdd e2e tests for core flows` | L4 Playwright 测试 |

### Phase 7: 收尾

| # | Commit | 内容 |
|---|--------|------|
| 44 | `chore: add cloudflare pages and worker deploy config` | wrangler.toml, 部署脚本 |
| 45 | `docs: add readme and changelog` | README (中文, 标准格式), CHANGELOG |

---

## 七、版本管理

- **版本号来源**：`package.json` (单一事实来源)
- **显示位置**：Sidebar badge (`v0.1.0`), `/api/live` 返回
- **初始版本**：`0.1.0`
- **迭代规则**：默认 Z+1; 改动 > 500 行或间隔 > 3 天则 Y+1, Z 置 0
- **发布流程**：更新 package.json → CHANGELOG → commit → tag `vX.Y.Z` → GitHub Release
