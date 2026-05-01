# 从 npm 到 pnpm：包管理器演进与 Monorepo 依赖冲突求生

> 同一个项目，npm 装完能跑，pnpm 装完就炸。这不是 pnpm 的 Bug，而是 npm 掩盖了你的 Bug。这篇文章从一次线上部署失败讲起，把 npm / yarn / pnpm 的本质区别、Monorepo 为什么需要 pnpm、以及依赖冲突的通用解法一次性讲清楚。

## 1. 开篇：本地能跑，线上炸了

某天我 push 代码后，GitHub Actions 的 Build 流水线报红了：

```
Error: Cannot find module '@qdrant/js-client-rest'
```

奇怪，我本地跑得好好的。

看了一下代码，`packages/ai/rag/qdrantVectorStore.ts` 里确实用了 `@qdrant/js-client-rest`：

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";
```

再看 `packages/ai/package.json`，依赖声明是这样的：

```json
{
  "dependencies": {
    "@langchain/qdrant": "^1.0.1"
  }
}
```

`@qdrant/js-client-rest` 并没有在 `package.json` 中声明，但代码里直接 import 了它。本地能跑是因为 npm 的扁平结构让它"看得见"这个包，但线上用 pnpm 构建时，严格的依赖隔离直接暴露了这个幽灵依赖。

**包管理器不只是"装包工具"，它决定了你的依赖结构，而依赖结构决定了你的项目能不能跑。**

## 2. npm / yarn / pnpm 的本质区别

### 2.1 npm v2：嵌套地狱

npm v2 的策略很简单——每个包在自己的 `node_modules` 下安装完整的依赖树：

```
node_modules/
├── express/
│   └── node_modules/
│       ├── debug/
│       │   └── node_modules/
│       │       └── ms/          ← 第 3 层
│       └── cookie/
├── react/
│   └── node_modules/
│       └── loose-envify/        ← 又一个嵌套
└── ...
```

问题很明显：

- **路径过长**：Windows 的路径长度限制 260 字符，嵌套几层就超了
- **磁盘浪费**：同一个包被重复安装几十次（10 个包都依赖 lodash，就装 10 份）
- **版本碎片**：不同层级的同一个包可能是不同版本，行为不一致

### 2.2 npm v3+ / yarn：扁平化——解决了嵌套，引入了幽灵依赖

npm v3 开始采用扁平化安装——所有依赖（包括间接依赖）都被提升到 `node_modules` 根目录：

```
node_modules/
├── @qdrant/js-client-rest/     ← 被提升上来了，你的代码能直接访问
├── @langchain/qdrant/
├── debug/
├── ms/                         ← 不再嵌套在 debug 下面
├── express/
├── react/
└── ...
```

yarn v1 的贡献在于：lockfile 保证确定性安装、并行安装提升速度。但扁平结构的根本问题没变——**依赖声明和实际访问不一致**。

你可以 import 任何被提升到根目录的包，不管你有没有声明它。这就是幽灵依赖。

### 2.3 pnpm：软链接 + 硬链接——严格隔离 + 磁盘共享

pnpm 的设计思路完全不同，采用三层结构：

**第一层：`.pnpm/` 目录**——所有包的真实存储位置，按 `包名@版本` 组织，每个包只能访问自己声明的依赖：

```
node_modules/.pnpm/
├── @qdrant+js-client-rest@1.17.0/
│   └── node_modules/
│       └── @qdrant/js-client-rest/    ← 真实文件
└── @langchain+qdrant@1.0.1/
    └── node_modules/
        ├── @langchain/qdrant/
        └── @qdrant/js-client-rest/    ← 软链接，只有 @langchain/qdrant 能访问
```

**第二层：项目根 `node_modules`**——只有你声明的依赖会出现在这里，通过软链接指向 `.pnpm/`：

```
node_modules/
├── .pnpm/                              ← 真实存储
├── @langchain/qdrant/                  ← 软链接 → .pnpm/@langchain+qdrant@1.0.1
├── langchain/                          ← 软链接 → .pnpm/langchain@1.2.16
└── (没有 @qdrant/js-client-rest！)     ← 没声明就访问不到
```

**第三层：全局 store**——硬链接共享，多个项目共用同一份磁盘数据。项目 A 和项目 B 都用 `react@19.1.0`，磁盘上只存一份。

### 2.4 三者对比

| 特性 | npm v3+ | yarn v1 | pnpm |
|------|---------|---------|------|
| 依赖结构 | 扁平 | 扁平 | 严格隔离 |
| 幽灵依赖 | ❌ 有 | ❌ 有 | ✅ 无 |
| 安装速度 | 慢 | 快 | 最快 |
| 磁盘占用 | 高（每个项目独立） | 高（每个项目独立） | 低（全局 store 共享） |
| lockfile | package-lock.json | yarn.lock | pnpm-lock.yaml |
| Monorepo 支持 | workspaces | workspaces | workspace（原生） |
| 依赖一致性 | 不保证 | 保证 | 严格保证 |

## 3. 为什么需要 Monorepo

### 3.1 没有 Monorepo 时的痛点

假设你有一个 Web 应用和一个 Mobile 应用，它们共享 AI 逻辑和数据库层。如果用独立仓库：

```
repo-web/          repo-mobile/       repo-ai/
├── src/           ├── app/           ├── src/
├── package.json   ├── package.json   ├── package.json
└── ...            └── ...            └── ...
```

问题马上就来了：

- **代码重复**：AI 逻辑在 Web 和 Mobile 各写一份，改一边忘改另一边
- **版本漂移**：Web 用 `@notion/ai@1.0.0`，Mobile 用 `@notion/ai@1.1.0`，行为不一致
- **联调成本高**：改了 `@notion/ai`，要先 publish → 另一个仓库更新依赖 → 再验证
- **Issue 分散**：同一个 Bug 可能在三个仓库各开一个 Issue

### 3.2 Monorepo 解决什么

Monorepo 把所有相关代码放在一个仓库里，通过工具管理包之间的依赖关系：

```
My-Notion/
├── apps/
│   ├── web/              # Web 应用
│   └── mobile/           # Mobile 应用
├── packages/
│   ├── ai/               # AI 核心逻辑（共享）
│   ├── business/         # 业务状态（共享）
│   └── convex/           # 数据库逻辑（共享）
└── services/
    └── ai/               # AI 网关
```

好处：

- **改一处，生效两端**：修改 `packages/ai` 的 RAG 逻辑，Web 和 Mobile 同时生效
- **版本强一致**：`workspace:*` 协议保证所有包用的是同一份源码
- **原子提交**：一个 PR 可以同时改共享包和应用层，review 一次搞定
- **统一工程化**：一套 CI/CD、一套 lint 规则、一套测试框架

### 3.3 Monorepo 的方案对比

| 方案 | 工具 | 特点 | 适合场景 |
|------|------|------|----------|
| **pnpm workspace** | pnpm 内置 | 轻量、原生支持、依赖隔离严格 | 中小型 Monorepo |
| **Turborepo** | Vercel | 增量构建、任务缓存、远程缓存 | 大型 Monorepo、构建性能敏感 |
| **Nx** | Nrwl | 依赖图分析、受影响项目检测、插件生态 | 企业级 Monorepo、复杂依赖图 |
| **Lerna** | Lerna | 老牌方案，现在已和 Nx 合并 | 历史项目维护 |

我的项目选择了 pnpm workspace，原因很简单：

1. **项目规模适中**——5 个包 + 2 个应用，不需要 Turborepo 的增量构建
2. **依赖隔离严格**——pnpm 的严格结构天然防止幽灵依赖
3. **零额外配置**——不需要装额外工具，`pnpm-workspace.yaml` 三行配置搞定
4. **磁盘效率高**——全局 store 共享，`node_modules` 占用从 GB 级降到 MB 级

如果项目规模增长到 20+ 个包，可以考虑在 pnpm workspace 基础上叠加 Turborepo 做增量构建。但起步阶段，pnpm workspace 足够了。

## 4. 幽灵依赖：扁平结构的定时炸弹

### 4.1 什么是幽灵依赖

幽灵依赖是指**代码中实际使用了某个包，但该包没有在 `package.json` 中显式声明，而是通过其他包的依赖间接引入的**。

```
你的代码
  └─ import { QdrantClient } from "@qdrant/js-client-rest"  ← 直接使用
       ↑
       │  (没有在 package.json 中声明)
       │
@langchain/qdrant (声明了)
  └─ @qdrant/js-client-rest  ← 间接依赖
```

### 4.2 我的真实案例

AI Agent 用 `npm install` 安装了 `@langchain/qdrant`，然后在代码里直接 import 了 `@qdrant/js-client-rest`。npm 的扁平结构把这个包提升到了根目录，本地运行完全没问题。但 CI 用 pnpm 构建，严格隔离下直接报 `Cannot find module`。

### 4.3 修复

```bash
# 1. 显式声明依赖
pnpm add @qdrant/js-client-rest

# 2. 清理并重装（如果之前用 npm 装过）
find . -name "node_modules" -type d -prune -exec rm -rf {} +
find . -name "package-lock.json" -delete
pnpm install
```

### 4.4 shamefully-hoist：不推荐的逃生舱

pnpm 提供了 `.npmrc` 中的 `shamefully-hoist=true`，可以让 pnpm 退化为扁平模式。名字已经说明了一切——"可耻地提升"。它只是掩盖了问题，不是解决了问题。除非遇到完全不兼容 pnpm 的第三方库，否则不要用。

## 5. pnpm Workspace 实战

### 5.1 配置

`pnpm-workspace.yaml`：

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

三行配置，告诉 pnpm 哪些目录是包。

### 5.2 workspace 协议

包间依赖用 `workspace:*`，指向本地源码而不是 npm registry：

```json
// apps/web/package.json
{
  "dependencies": {
    "@notion/ai": "workspace:*",
    "@notion/business": "workspace:*",
    "@notion/convex": "workspace:*"
  }
}
```

修改 `packages/ai` 的代码后，`apps/web` 立即生效，不需要 `npm link` 或 publish。

### 5.3 常用命令

```bash
# 安装所有依赖
pnpm install

# 递归执行所有包的构建（自动处理依赖顺序）
pnpm -r run build

# 指定包操作
pnpm --filter @notion/web add lodash
pnpm --filter @notion/web dev

# 查看某个包为什么被安装
pnpm why lodash

# 递归查看某个依赖的版本
pnpm list react -r
```

## 6. Monorepo 依赖冲突：那些让你怀疑人生的报错

### 6.1 "两个 React 实例"错误

**现象**：

```
Invalid hook call. Hooks can only be called inside of the body of a function component.
```

这个报错极其误导——你以为是自己写错了 Hook，实际上是因为存在两个 React 实例。

**原因**：Monorepo 中不同包引用了不同路径的 `react`。比如 `apps/web` 通过 `react` 访问，`packages/business` 通过软链接路径访问，pnpm 认为这是两个不同的包。

**解决**：在根 `package.json` 中用 `pnpm.overrides` 强制统一版本：

```json
{
  "pnpm": {
    "overrides": {
      "react": "19.1.0",
      "react-dom": "19.1.0"
    }
  }
}
```

同时配合 `resolutions`（兼容 yarn）：

```json
{
  "resolutions": {
    "react": "19.1.0",
    "react-dom": "19.1.0"
  }
}
```

### 6.2 prosemirror-view 版本冲突

**现象**：BlockNote 和 TipTap 都依赖 `prosemirror-view`，但版本范围不同。

**原因**：`@blocknote/core` 要求 `prosemirror-view@^1.31.4`，而其他 prosemirror 包可能解析到更低版本。pnpm 严格模式下，同一个包的不同版本会分别安装，导致类型不兼容。

**解决**：

```json
{
  "resolutions": {
    "prosemirror-view": "^1.31.4"
  }
}
```

### 6.3 workspace:* 与发布版本的冲突

**现象**：本地开发正常，但 `pnpm publish` 时 `workspace:*` 不会被自动替换。

**原因**：`workspace:*` 是 pnpm 的本地协议，npm registry 不认识这个版本号。

**解决**：

- 方案 1：使用 `changeset` 管理版本，发布前自动替换 `workspace:*`
- 方案 2：手动执行 `pnpm -r publish --no-git-checks`，pnpm 会自动替换

### 6.4 peerDependencies 的处理

**现象**：`@clerk/nextjs` 声明 `react` 为 peerDependency，pnpm 默认严格检查，版本不匹配直接报错。

**解决**：`.npmrc` 中配置：

```ini
strict-peer-dependencies=false
```

或者安装时加 `--ignore-workspace-root-check`。

## 7. 依赖冲突的通用解决套路

### 7.1 排查工具

```bash
# 查看某个包为什么被安装、被谁依赖
pnpm why <package>

# 递归查看所有包中某个依赖的版本
pnpm list <package> -r

# 去重，将满足范围要求的依赖提升到公共位置
pnpm dedupe
```

### 7.2 解决策略（按优先级）

| 优先级 | 策略 | 适用场景 |
|--------|------|----------|
| 1 | `pnpm.overrides` 统一版本 | 核心依赖版本不一致（react、typescript） |
| 2 | 显式声明间接依赖 | 幽灵依赖，代码用了但没声明 |
| 3 | `workspace:*` 管理包间依赖 | Monorepo 内部包引用 |
| 4 | 降级兼容 | A 要求 `^5.0`、B 要求 `^4.0`，找 A 的旧版本 |
| 5 | `shamefully-hoist` | 最后手段，第三方库完全不兼容 pnpm |

### 7.3 预防措施

- 根 `package.json` 中用 `pnpm.overrides` 锁定核心依赖版本
- CI 中加 `pnpm install --frozen-lockfile`，禁止自动更新 lockfile
- 定期执行 `pnpm dedupe` 清理冗余依赖
- 用 `workspace:*` 管理包间依赖，不要用文件路径或 npm 版本号
- **永远不要混用 npm 和 pnpm**——一旦用 npm 装过包，`node_modules` 结构就被污染了

## 8. 总结

| | npm / yarn | pnpm |
|---|---|---|
| 依赖结构 | 扁平，间接依赖可见 | 严格隔离，只访问声明的依赖 |
| 幽灵依赖 | 本地不报错，线上可能炸 | 开发阶段直接暴露 |
| Monorepo 支持 | workspaces（基本） | workspace（原生 + 严格） |
| 磁盘效率 | 每个项目独立存储 | 全局 store 硬链接共享 |
| 依赖冲突 | 静默通过，运行时可能出问题 | 安装时报错，强制解决 |

包管理器的选择不只是"装包快不快"，而是决定了依赖结构的严谨程度。npm/yarn 的扁平结构掩盖了幽灵依赖，pnpm 的严格结构在开发阶段就暴露问题。

对于 Monorepo 项目，pnpm workspace 是当前最合理的选择——严格隔离防止幽灵依赖、`workspace:*` 保证包间版本一致、全局 store 节省磁盘空间。如果项目规模增长，可以在 pnpm 基础上叠加 Turborepo 做增量构建。

最后一条建议：**CI/CD 用 pnpm 构建 = 免费的依赖健康检查**。本地 npm 能跑不代表线上能跑，但本地 pnpm 能跑，线上一定能跑。

---

*本文基于 [My-Notion](https://github.com/HaveNiceDa/My-Notion) 项目的真实踩坑经历撰写——一个 AI 原生的个人版 Notion，采用 pnpm workspace Monorepo 架构。欢迎 Star ⭐*
