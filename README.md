<p align="center">
  <img src="assets/brand/icon-rounded.png" alt="Neo" width="128" height="128" />
</p>

<h1 align="center">Neo</h1>

<p align="center">在浏览器中管理双重认证密钥、查看 TOTP 验证码和维护备份。</p>

<p align="center">
  <a href="https://neo.hexly.ai">站点</a> ·
  <a href="docs/README.en.md">English</a>
</p>

## 这是什么

Neo 是一个可自行部署的 Web 认证器。通过 Google 登录后，可以集中管理认证密钥，在浏览器中生成 TOTP 验证码，并在更换认证器时导入、导出数据。服务端使用 Next.js，业务数据存入 Cloudflare D1，并按用户查询。

当前数据库保存的是可由服务端读取的 Base32 密钥。AES-GCM 加密用于导出的备份 ZIP，备份加密密钥也保存在 D1；使用该服务意味着信任部署者及其数据库访问控制。

## 功能

- 按名称或账号查找密钥，添加、编辑和复制 TOTP 验证码；支持 SHA-1 / SHA-256 / SHA-512、6 / 8 位验证码及 30 / 60 秒周期。
- 删除后进入回收站，可恢复，也可永久删除或清空回收站。
- 导入和导出 `otpauth://` URI，以及 Aegis、andOTP、2FAS、Bitwarden 等工具的受支持明文格式；批量导入会检查重复项。
- 下载 AES-GCM 加密的备份 ZIP，使用对应密钥恢复；可配置 Backy 推送与拉取 webhook，把归档交给 Backy 保存。
- 在 Tools 页面预览导入结果、转换导出格式和测试 TOTP 参数。
- 切换中英文与浅色、深色主题；提供 PWA 安装入口和离线回退页面。

数据模型和导入器包含 HOTP 字段，当前主界面只生成 TOTP 验证码。登录、读取最新数据和修改密钥需要网络；PWA 的缓存与离线回退不等于完整的离线密钥管理。加密的第三方导出文件需要先在原工具中转换为受支持格式。

## 使用

1. 打开[站点](https://neo.hexly.ai)，使用部署者允许的 Google 账号登录。
2. 在密钥页面添加条目，或打开 Import 粘贴、上传受支持的明文导出内容。
3. 按名称或账号搜索，在卡片上复制当前 TOTP 验证码。
4. 需要备份时，先在 Settings 生成并另行保存加密密钥，再到 Backup 下载归档。恢复时需要原归档对应的密钥。

Backy 是可选集成。在 Settings 配置 Backy webhook URL 与 API key 后，可手动推送归档。定期备份由 Backy 调用 Neo 的 `/api/backy/pull` 触发，配置方法见[备份说明](docs/02-backup-consolidation.md)。

## 开发

需要 Bun、Node.js 22.12+、Google OAuth 凭据和可通过 HTTP API 访问的 Cloudflare D1 数据库。

```bash
git clone https://github.com/nocoo/neo.git
cd neo
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
```

仓库没有 `.env.example`。创建 `.env.local`，配置下列变量：

| 变量 | 用途 |
| --- | --- |
| `AUTH_SECRET` | Auth.js 会话签名密钥 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth 客户端凭据 |
| `AUTH_URL` | 本地填写 `http://localhost:7026`；部署时填写实际站点地址 |
| `ALLOWED_EMAILS` | 逗号分隔的登录邮箱名单；为空时拒绝所有登录 |
| `CLOUDFLARE_ACCOUNT_ID` | D1 所属 Cloudflare 账号 |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 数据库 ID |
| `CLOUDFLARE_API_TOKEN` | 有权查询目标 D1 的 API token |

Google OAuth 的本地回调地址为 `http://localhost:7026/api/auth/callback/google`。在新建 D1 数据库中按顺序执行以下 SQL；应用启动不会自动创建表：

1. [初始表结构](drizzle/0000_pink_archangel.sql)
2. [条目颜色字段](drizzle/0001_green_karnak.sql)
3. [回收站字段](drizzle/0002_recycle_bin.sql)
4. [备份密钥与 Backy 字段](migrations/0001_add_backy_and_encryption_key.sql)

```bash
bun run dev       # Webpack 开发服务，http://localhost:7026
bun run build     # 生产构建，包含 Serwist Service Worker
bun run start     # 本地启动生产构建，端口 7026
```

`bun run typecheck` 同时检查主应用和 `worker/`；`bun run lint` 使用 Biome。主应用也可以使用仓库的 [Dockerfile](Dockerfile) 部署。

可选的 `worker/` 提供 `POST /otp`、`GET /favicon/:domain` 和 `/health`。它独立于 Next.js 应用，需要自己的 Wrangler 配置与 D1 限流表。使用 [wrangler.toml.example](worker/wrangler.toml.example) 时，替换 D1 binding，并移除其中遗留的 cron 配置；当前 Worker 没有 `scheduled` 处理函数。准备好配置与 [SQL](worker/migrations/0001_rate_limits.sql) 后，可运行 `bun run --cwd worker dev`。

```text
actions/           服务端密钥、设置与备份操作
app/               Next.js 页面、API 和 Service Worker
components/        界面组件
viewmodels/        UI 状态与交互逻辑
models/            OTP、导入导出、加密归档
lib/db/            D1 HTTP 客户端与按用户查询
worker/            可选 OTP 与 favicon 服务
```

## 测试

从仓库根目录执行：

| 测试层 | 命令 |
| --- | --- |
| 主应用单元与组件测试 | `bun run test:unit` |
| Server Action 集成测试 | `bun run test:api` |
| 本地 HTTP 端到端测试 | `bun run test:e2e` |
| 浏览器冒烟测试 | `bun run test:e2e:pw` |
| 独立 Worker 单元测试 | `bun run --cwd worker test` |

Server Action 测试使用内存存储替代 D1。HTTP 测试自动启动端口 `17026` 的 Next.js 服务，使用测试身份和内存数据库；运行前保持该端口空闲。浏览器测试先执行 `bunx playwright install chromium`，会自动启动端口 `27026` 的服务，当前用例检查登录页加载。以上测试不需要真实 D1 数据或 Google 登录。

## 技术栈

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Cloudflare D1](https://img.shields.io/badge/Cloudflare_D1-F38020?logo=cloudflare&logoColor=white)
![Web Crypto](https://img.shields.io/badge/Web_Crypto-555555)

| 部分 | 实现 |
| --- | --- |
| Web 应用 | Next.js App Router、React、Tailwind CSS、Basalt UI |
| 登录与数据 | Auth.js / NextAuth、Google OAuth、D1 HTTP API；Drizzle 定义 schema |
| OTP 与备份 | Web Crypto、fflate、Backy webhook |
| PWA 与可选服务 | Serwist、Cloudflare Workers |
| 开发与测试 | Bun、Webpack、TypeScript、Biome、Vitest、Playwright |

## 文档

- [文档索引](docs/README.md)
- [备份归档与 Backy 设计](docs/02-backup-consolidation.md)
- [数据表定义](lib/db/schema.ts)
- [变更记录](CHANGELOG.md)

历史设计文档保留了迁移过程与已替换的方案；当前入口和运行方法以本 README 及源码为准。

## 许可证

[MIT](LICENSE) © 2026
