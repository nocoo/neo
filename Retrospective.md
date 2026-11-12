# Retrospective

Accident narratives and original lessons. Historical instructions below describe their time; the current handbook and its local-isolation contract take precedence.

## 2026-07-19 — TS 7 升级与 Biome 迁移 (5-commit 后又 codex 复审 5-commit)

### 教训 1: 大改动必须跑生产 build

TS 6.0.3 → 7.0.2 那次提交, 我只跑了 `typecheck / lint / test:coverage` 就宣告完成, 没跑 `bun run build`。codex 复审时立刻发现 build 全崩 (所有 `@/*` 路径 unresolved)。

**根因**: Next 16.2.10 的 `load-jsconfig` 需要 `typescript/lib/typescript.js`, TS 7 已经删除该文件 → next 完全没读 tsconfig → paths 全丢。TS 严格模式下 `baseUrl` 被删除 (TS5102) 也放大了这个问题。

**下次**: 涉及 TS、bundler、Next 版本任何一个升级, 必须把 `bun run build` 加入验证清单。type-only 检查通过 ≠ build 通过。

### 教训 2: biome autofix 会改语义, 不能盲信

biome 的 `useExhaustiveDependencies` 对下面这个模式判为 "vm.searchQuery 不必要":

```tsx
useEffect(() => {
  setSelectedIndex(null);
}, [vm.searchQuery]);
```

它把 deps 自动改成 `[]`。但那个 dep 是**触发时机**, 不是被 body 读的值。改成 `[]` 后 effect 只在 mount 跑一次, 键盘选择在搜索过滤后不重置, 回车/空格会复制错卡片。

**下次**: 在跑 `biome check --write --unsafe` 之前, 先看 diff。有语义变化 (deps、逻辑、类型) 的自动修复要人工过一遍再接受。触发型 effect 加 `biome-ignore` 说明"dep 是触发, body 不读"。

### 教训 3: pre-commit 必须验证 index 快照

pre-commit 里 tsc + vitest 直接跑在工作树上。这有两个漏洞:

1. **并发写竞争**: `lint-staged --write` 会 stash + apply + rewrite, 与 tsc/vitest 并行时它们可能读到中间态。
2. **index/工作树背离**: 用户把 broken 代码 stage, 又在工作树里修好, hook 读的是"修好后的工作树", 但**commit 只保存 index** —— broken 版本仍然 landed。

正解: `git checkout-index --prefix=$SNAP/ -a` 材料化 index, symlink `node_modules`, tsc + vitest 在 snapshot 里跑。pew 只对自定义 gate 用了这招, 主 tsc/vitest 没用 — 是不完整的方案。

**下次**: 任何 "验证 commit 内容" 的 hook, 必须操作 index snapshot, 不能操作工作树。

### 教训 4: 子目录也是 CI 的一等公民

改根 `typecheck` 脚本, 加了 `bun run --cwd worker typecheck`, 本地一切正常。CI 只装了根依赖, worker/node_modules 不存在 → TS2688 找不到 `@cloudflare/workers-types`。

**下次**: 改跨 workspace 的构建脚本时, 同步检查 `.github/workflows/*.yml` 的 `extra-install-dirs`(或等价参数)。CI 的依赖安装与本地开发依赖安装是两回事。

### 教训 5: 一次 review 通常不够

codex 的第一轮找出 5 个问题 (P1 #1/#2 + P2 #3/#4/#5), 我全修完自认完成。codex 复审又找出 2 个新问题 (CI worker 缺依赖, hook 仍验证工作树) —— 都是**上一轮修复本身引入的**副作用。

**下次**: 每次修复完 code review 意见后, 主动请求 (或想象) 复审。特别是修复涉及自动化 (hooks / CI / lint config) 时, 变更本身会产生新的暴露面, 至少要问一句"我的修复引入了什么新问题"。

## 2026-10-04 — Keep dependency scope and security evidence explicit

The root app and optional Worker have independent Bun manifests and locks. Validate both and update paired Vitest/coverage packages in every issue-listed scope; a root-only scan misses Worker requests. Current strict scans no longer need the two expired advisory waivers, so remove them without relaxing any gate. The existing local HTTP runner can kill fixed-port owners: this duty rejects any occupied test port before invocation, removes ambient production credentials and uses only its owned checkout and memory adapter. This operational guard does not certify a complete race-free SQL/browser isolation lane. Preserve the Next/Webpack/Serwist path and verify a real build after Next updates.

## 2026-11-12 — System0 12-slot migration

### 1. `gitleaks git --staged` 会漏掉新文件内容

第一版 G1 用 `gitleaks git --staged` 扫暂存区。8.30.1 对新增文件只扫到 diff header，伪造的 AWS key 直接通过；独立 `gitleaks dir` 却能命中。现在 pre-commit 用 `git checkout-index` 导出 index 快照后扫目录，pre-push 按每个被推送 OID 的区间扫 `gitleaks git`。`bun run check:hooks` 固定保留“暂存一次、推送区间一次”的真实 fake-key 注入，任何 allowlist 都不能替代它。

### 2. E2E 内存存储会被 Next 的 route bundle 复制

新增“创建 → 加密导出 → 解密 → TOTP”L3 旅程时，`/api/e2e/settings` 生成的 key 在 `/api/backup/archive` 里读不到，返回 400。根因是 Next 开发构建把 `lib/e2e/scoped-db.ts` 复制进不同 route bundle，模块级数组不共享。现在状态挂在 `globalThis` 上，并改为原地清空/删除；跨 route bundle 仍然只使用同一份进程内存储。这条旅程以后必须保留，它同时证明了 key、加密 ZIP、解密和 TOTP 的真实链路。

### 3. 不要用 per-PID 的 Next distDir

最初把 L3/L4 的 `NEXT_DIST_DIR` 设成 `.next-e2e-${pid}`。Next dev 会把该路径写回 `tsconfig.json` 的 include，每次跑测试都污染工作树。现在使用每个 lane 固定的 `.next-e2e` / `.next-e2e-pw`，启动前清空、结束后删除；端口占用直接失败，因此同一 worktree 不会并发复用。worktree 之间各自持有目录，互不影响。

### 4. green CI 不能自动上生产

迁移前 `release.yml` 监听 `workflow_run(CI completed)`。如果先推 main 再改发布链路，CI 一绿就会自动部署生产。现在发布只保留 `workflow_dispatch`，操作者必须提供成功 main-push CI 的 run ID；base-ci v2026.15 `deploy-docker` 会校验该 SHA 上的 `quality / Z1: Gate`。阶段一推送前先确认这一点。

### 5. 门禁脚本也要进类型检查

`scripts/` 原先被 `tsconfig.json` 排除，门禁脚本只有运行时自测。现在 `tsconfig.scripts.json` 用 `@types/bun` 单独检查脚本，主应用配置不引入 Bun 全局类型；同时删除了已无使用者的 `lint-staged` 依赖。不要把脚本类型检查塞回主 tsconfig，否则 Bun 的 `fetch` 类型会污染现有单元测试。

## 2026-11-12 — System0 migration review round 1

### 1. Reusing worktree `node_modules` is not dependency proof

The first hooks compared manifests and locks, then symlinked the worktree install into the snapshot. A lockfile declaring `2.0.0` still passed while the installed tree remained `1.0.0`. Both hooks now run an isolated `bun install --frozen-lockfile --ignore-scripts` in the snapshot; the self-test pushes a new dependency version while the worktree keeps the old one and proves the gate sees the pushed version.

### 2. A new ref must not skip secrets because another remote ref contains the commit

`<oid> --not --remotes` excluded commits reachable from any remote-tracking ref, so a new branch could bypass G1 when the same commit was already fetched under another remote branch. A new ref now scans the full history reachable from its OID; an existing ref scans `<remote-sha>..<local-sha>`. G1 also runs once per distinct range, so the same OID pushed to two refs with different remote bases cannot skip the second range.

### 3. The stage budget must include preparation and cleanup

The gate timer started after dependency installation and restarted for every pushed OID. Preparation is now exported as `GATE_PREP_SECONDS`, cumulative across the whole push, and the hook enforces the hard wall budget after cleanup as well.

### 4. A runtime-version reference must resolve or fail

Parsing only literal `runtime-version: X.Y.Z` silently accepted a workflow using `${{ env.BUN_VERSION }}`. The parser now resolves the referenced env declaration; a missing or unresolved declaration fails preflight instead of passing.
