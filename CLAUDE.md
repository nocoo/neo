# Retrospective

## 2026-07-19 — TS 7 升级与 Biome 迁移 (5-commit 后又 codex 复审 5-commit)

### 教训 1: 大改动必须跑生产 build

TS 6.0.3 → 7.0.2 那次提交, 我只跑了 `typecheck / lint / test:coverage` 就宣告完成, 没跑 `bun run build`。codex 复审时立刻发现 build 全崩 (所有 `@/*` 路径 unresolved)。

**根因**: Next 16.2.10 的 `load-jsconfig` 需要 `typescript/lib/typescript.js`, TS 7 已经删除该文件 → next 完全没读 tsconfig → paths 全丢。TS 严格模式下 `baseUrl` 被删除 (TS5102) 也放大了这个问题。

**下次**: 涉及 TS、bundler、Next 版本任何一个升级, 必须把 `bun run build` 加入验证清单。type-only 检查通过 ≠ build 通过。

### 教训 2: biome autofix 会改语义, 不能盲信

biome 的 `useExhaustiveDependencies` 对下面这个模式判为 "vm.searchQuery 不必要":

```tsx
useEffect(() => { setSelectedIndex(null); }, [vm.searchQuery]);
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
