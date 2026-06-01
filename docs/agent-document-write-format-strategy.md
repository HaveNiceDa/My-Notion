# Agent 写文档格式策略技术方案

## Summary

本方案决策：**Agent 对外读写文档统一使用 Markdown 契约，服务端/CLI/MCP 负责 Markdown 与 BlockNote blocks 的双向受控转换；不要求普通 Agent 直接生成或解析 BlockNote JSON。**

短期保持现有 `contentMarkdown` 契约稳定，避免破坏已经完成的 CLI / Skills / MCP / Web Agent dry-run 链路。下一步重点不是暴露 BlockNote JSON，而是把当前过于简化的 Markdown 双向转换器升级为可验证、可回滚、可跨端复用的受控内容适配层。

核心结论：

- 对外契约：`contentMarkdown` 继续作为 CLI、Skills、MCP、Web Agent 的默认读写视图。
- 内部存储：`documents.content` 继续保存 BlockNote JSON string。
- 转换归属：Markdown -> BlockNote blocks 与 BlockNote blocks -> Markdown 都在服务端共享包完成，而不是让 Agent 自行拼或解析 BlockNote JSON。
- 安全链路：所有 Agent 写入继续遵循 `Dry-run -> Preview -> User Confirmation -> Commit`。
- 可扩展性：未来只给高级/内部工具开放 `contentBlocks`，且必须经过 schema 校验、归一化和 feature flag，不作为默认 Agent 接口。

## Current State Analysis

### 当前存储与编辑器事实

- Web 编辑器在 `apps/web/src/components/Editor.tsx` 中使用 BlockNote，初始化时把 `initialContent` 解析为 `PartialBlock[]`，保存时写入 `JSON.stringify(editor.document, null, 2)`。
- Convex `documents` 表在 `packages/convex/schemas/document.ts` 中把 `content` 定义为 `v.optional(v.string())`，注释明确为 BlockNote 格式。
- Mobile 在 `apps/mobile/app/(home)/document/[documentId].tsx` 中通过 `@notion/business/content-compat` 把已存内容转换为 TenTap HTML，再把 HTML 序列化回 BlockNote JSON。
- `packages/business/content-compat/index.ts` 已存在 BlockNote JSON <-> HTML 的兼容层，支持 heading、list、check list、quote、code block、divider、image、inline styles、link 等结构。

### 当前 Agent/CLI/MCP 读写事实

- CLI `packages/my-notion-cli/src/commands/docs.ts` 的 `docs create/update/import` 都只接收 Markdown，并传给 `contentMarkdown`。
- CLI `docs fetch/export`、MCP `my_notion_docs_fetch` 和 Agent 二次编辑都依赖响应里的 `contentMarkdown`，因此反向转换不是附属能力，而是修改文档闭环的前提。
- MCP `packages/my-notion-cli/src/mcp/server.ts` 的 `my_notion_docs_create` 和 `my_notion_docs_update` 都暴露 `contentMarkdown`，写工具默认 `dryRun: true`。
- Web Agent `apps/web/src/lib/agent/tools/document-write.ts` 和 `apps/web/src/lib/agent/tools/definitions.ts` 也只让 LLM 生成 `contentMarkdown`，且只返回 dry-run 预览。
- CLI 类型 `packages/my-notion-cli/src/types.ts` 中的 `DocumentResult` 同时返回 `content` 和 `contentMarkdown`，其中 `contentFormat` 表示内部格式。

### 当前双向转换器问题

- `packages/convex/documents/logic/markdown.ts` 的 `markdownToBlockNoteJson` 目前只是按行拆分，每行生成一个 `paragraph`。
- `blockNoteJsonToMarkdown` 也只处理 `content` 为 string 或 text inline array 的简单场景。
- 这会导致 Agent 输出的 Markdown 标题、列表、任务列表、代码块、引用、分隔线、链接、粗体、斜体等结构在写入后丢失或退化。
- 反向读取同样存在损耗：如果 BlockNote -> Markdown 不完整，Agent 会在“读取 -> 修改 -> 写回”链路中丢失结构。
- 当前转换器能维持“可写入、可读取”，但不足以支撑高质量 Agent 写文档和修改文档体验。

### M16 决策背景

`milestones/M16-cli-skills-mcp-agent-docs.md` 已将“Agent 写入格式策略”列为 P0：需要在“服务端/CLI 增加 Markdown -> BlockNote blocks 转换器”和“让 Agent 直接生成受约束 BlockNote JSON”之间形成决策。

## Decision

### 选择 A：Markdown 作为默认 Agent 读写契约

推荐并采纳：

```text
Agent / CLI / Skills / MCP / Web Agent
  -> contentMarkdown
  -> shared Markdown parser / normalizer
  -> BlockNote blocks
  -> documents.content
  -> shared BlockNote serializer
  -> contentMarkdown
  -> Agent / CLI / Skills / MCP / Web Agent
```

不推荐把普通 Agent 的默认输入/输出改为 BlockNote JSON：

```text
Agent
  -> constrained BlockNote JSON
  -> validation / normalization
  -> documents.content
```

### 决策理由

- Markdown 是 Agent 最稳定、成本最低的生成格式，LLM 对 Markdown 的遵循能力明显优于复杂嵌套 JSON。
- CLI、Skills、MCP、Web Agent 当前已经围绕 `contentMarkdown` 建立契约，继续沿用能最大限度减少破坏性变更。
- BlockNote JSON 是编辑器内部格式，细节受 BlockNote 版本、Web/Mobile 兼容层和自定义扩展影响，不适合作为通用外部输入协议。
- Markdown 转换器可以集中演进、统一测试、统一降级，错误恢复比“每个 Agent 自行生成 JSON”更可控。
- CLI 已经具备读取、导出和更新文档能力；因此 BlockNote -> Markdown 必须是一等能力，保证 Agent 二次编辑不丢结构。
- 移动端已有 HTML/BlockNote 兼容层，未来可把 Markdown 转换能力放到共享包，形成 Web / Mobile / CLI / Convex 一致的内容适配策略。

## Alternatives Considered

### 方案 A：Markdown <-> BlockNote blocks 双向转换器

优势：

- Agent 侧最简单，提示词和工具 schema 稳定。
- 支持 CLI 文件流，适合 `--content-file`、`docs import`、MCP 工具调用。
- 错误恢复容易：非法 Markdown 可以按 plain text 或 paragraph 降级。
- 与 `docs export --format markdown`、搜索、RAG、知识库摘要天然一致。
- 便于在 dry-run 中展示人类可读预览。
- 支持 Agent “读取 Markdown 视图 -> 修改 Markdown -> 写回 BlockNote”的完整闭环。

劣势：

- 会存在 Markdown 与 BlockNote 表达能力差异。
- 高级 BlockNote 能力需要额外扩展 Markdown 约定，例如 callout、columns、toggle。
- 需要维护双向转换器和 round-trip 测试。

### 方案 B：Agent 直接生成受约束 BlockNote JSON

优势：

- 理论上转换损耗更低。
- 可精确表达 BlockNote block 类型、props、children 和 inline styles。
- 对复杂布局或编辑器内部操作更接近最终状态。

劣势：

- Agent 生成嵌套 JSON 的稳定性和可读性差，尤其是长文、代码块、列表嵌套和 escape 场景。
- schema 复杂，错误定位成本高，用户很难审阅 dry-run。
- BlockNote 版本升级可能导致外部 Agent 输出失效。
- 对 Skills/MCP 文档和第三方 Agent 适配成本高。
- 一旦 JSON 部分合法但语义错误，可能比 Markdown 退化更难恢复。

### 方案 C：双通道并行，Agent 可选 Markdown 或 BlockNote JSON

暂不作为默认方案。

原因：

- 短期会扩大接口面，增加 CLI / MCP / Web Agent / Convex / 文档 / 测试矩阵。
- 双通道会让 Agent 不知道优先选哪种格式，增加使用歧义。
- 可作为长期高级能力，但必须通过 feature flag、明确 schema 版本和独立验证工具引入。

## Proposed Changes

### 1. 提升 Markdown 双向转换器质量

文件：

- `packages/convex/documents/logic/markdown.ts`
- 可考虑新增 `packages/convex/documents/logic/markdown.test.ts`

做法：

- 将当前“按行 paragraph”实现升级为受控双向转换器。
- `markdownToBlockNoteJson` 支持最小必需语法：
  - `#` 到 `######` heading -> `heading` block，`props.level` 为 1-6。
  - 空行分段 -> `paragraph`。
  - `-` / `*` / `+` 列表 -> `bulletListItem`。
  - `1.` 列表 -> `numberedListItem`。
  - `- [ ]` / `- [x]` -> `checkListItem`。
  - `>` -> `quote`。
  - fenced code block -> `codeBlock`，保留 language。
  - `---` / `***` / `___` -> `divider`。
  - inline bold / italic / code / link -> BlockNote inline content。
- `blockNoteJsonToMarkdown` 反向支持同一组结构：
  - `heading` -> `#` 到 `######`。
  - `paragraph` -> Markdown 段落。
  - `bulletListItem` / `numberedListItem` / `checkListItem` -> 对应列表。
  - `quote` -> `>`。
  - `codeBlock` -> fenced code block。
  - `divider` -> `---`。
  - inline text styles -> bold / italic / code / link。
- 对不支持的 Markdown 节点降级为 paragraph，不抛非必要异常。
- 对不支持的 BlockNote block 降级为纯文本 Markdown，优先保留文字内容、顺序和层级。
- 输出统一补齐 BlockNote 常用 props：`backgroundColor`、`textColor`、`textAlignment`。
- block id 可选择不生成或生成稳定前缀；需要与 Web BlockNote 初始化兼容。

为什么：

- 保持外部 Markdown 契约不变，同时显著提升读取、写入和二次编辑质量。
- 让 CLI/MCP/Agent 同时受益，不需要改多个入口。

### 2. 引入内容格式契约常量和 schema 版本

文件：

- `packages/my-notion-cli/src/types.ts`
- `packages/convex/cli/index.ts`
- `packages/convex/documents/logic/markdownWrite.ts`

做法：

- 保持响应中的 `contentFormat: "blocknote-json"`。
- 明确 `contentMarkdown` 是从内部 BlockNote JSON 序列化得到的 Agent 可编辑 Markdown 视图。
- 可新增内部常量，例如 `CONTENT_FORMAT_BLOCKNOTE_JSON = "blocknote-json"`，避免散落字符串。
- 暂不对外新增 `contentBlocks` 参数。
- dry-run 继续返回 `contentMarkdown`，不要求客户端展示 BlockNote JSON。

为什么：

- 让外部消费者清楚：外部读写视图是 Markdown，内部存储主格式是 BlockNote JSON，同时提供稳定 Markdown 回读。

### 3. 强化 Web Agent 写工具描述

文件：

- `apps/web/src/lib/agent/tools/definitions.ts`
- `apps/web/src/lib/agent/tools/document-write.ts`

做法：

- 明确 `contentMarkdown` 是唯一默认写入格式。
- 明确读取文档后，Agent 应基于返回的 `contentMarkdown` 生成更新内容。
- 在 tool description 中补充“不要生成 BlockNote JSON；由系统转换为编辑器块”。
- dry-run 结果可增加 `inputFormat: "markdown"` 和 `targetFormat: "blocknote-json"` 元数据。

为什么：

- 减少 Agent 误生成 JSON 的概率。
- 让 UI 后续展示预览时能清楚说明转换边界。

### 4. 强化 CLI / MCP / Skills 文档

文件：

- `packages/my-notion-cli/README.md`
- `packages/my-notion-skills/README.md`
- `packages/my-notion-skills/my-notion-docs/SKILL.md`
- `packages/my-notion-skills/my-notion-mcp/SKILL.md`
- `packages/my-notion-skills/my-notion-docs/references/cli-commands.md`

做法：

- 统一写明：Agent 只生成 Markdown，不生成 BlockNote JSON。
- 说明系统会在服务端完成 Markdown <-> BlockNote blocks 双向转换。
- 说明 `docs fetch/export` 返回的 Markdown 是系统从 BlockNote JSON 序列化得到的 Agent 可编辑视图。
- 说明推荐 Markdown 子集和不支持内容的降级策略。
- 修改 Skills 后必须运行：

```bash
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```

为什么：

- Agent 生态依赖文档和 Skill 指令；必须从源头减少格式歧义。

### 5. 增加转换器测试和端到端回归

文件：

- `packages/convex/documents/logic/markdown.test.ts` 或包内现有测试目录。
- `packages/my-notion-cli/__tests__/docs-command.test.ts`
- `scripts/e2e-my-notion-mcp-sdk-client.mjs`

测试范围：

- heading、paragraph、bullet list、numbered list、check list、quote、code block、divider。
- inline bold、italic、code、link。
- Markdown -> BlockNote -> Markdown 的 round-trip 语义不丢高频结构。
- BlockNote -> Markdown -> BlockNote 的 round-trip 至少保留文本、层级和常用块类型。
- append 模式不会破坏已有 blocks。
- fetch/export 能返回可读 Markdown。
- MCP dry-run 仍不写入，真实写入后 fetch 能读取 Markdown。

为什么：

- 该策略的核心风险在转换损耗；必须用测试锁住高频语法。

### 6. 记录架构决策

文件：

- `docs/agent-document-write-format-strategy.md`
- `docs/README.md`
- `milestones/M16-cli-skills-mcp-agent-docs.md`
- `progress/20260527-20260531-consolidated.md`

做法：

- 将本方案沉淀为长期维护文档。
- 在 `docs/README.md` 增加索引。
- 在 M16 中将 P0 写入格式策略从“待决策”改为“已决策：Markdown 外部读写契约 + 服务端 BlockNote 双向转换”。
- 在 progress 中追加阶段摘要。

为什么：

- 这是跨 CLI / Skills / MCP / Web Agent / Mobile 的长期接口决策，不能只存在聊天记录中。

## Interface Contract

### 默认写入输入

CLI / MCP / Web Agent 默认写入参数：

```json
{
  "title": "Project Plan",
  "contentMarkdown": "# Project Plan\n\n- Goal\n- Scope",
  "dryRun": true
}
```

更新参数：

```json
{
  "documentId": "j57...",
  "contentMarkdown": "## Update\n\nNew section.",
  "mode": "append",
  "dryRun": true
}
```

### 默认写入输出

```json
{
  "dryRun": true,
  "confirmationRequired": true,
  "inputFormat": "markdown",
  "targetFormat": "blocknote-json",
  "contentMarkdown": "# Project Plan\n\n- Goal\n- Scope"
}
```

真实写入后：

```json
{
  "id": "j57...",
  "title": "Project Plan",
  "content": "[{\"type\":\"heading\",...}]",
  "contentMarkdown": "# Project Plan\n\n- Goal\n- Scope",
  "contentFormat": "blocknote-json"
}
```

### 默认读取输出

CLI `docs fetch/export`、MCP `my_notion_docs_fetch` 和 Web Agent document read 应优先让 Agent 使用 `contentMarkdown`：

```json
{
  "id": "j57...",
  "title": "Project Plan",
  "content": "[{\"type\":\"heading\",...}]",
  "contentMarkdown": "# Project Plan\n\n- Goal\n- Scope",
  "contentFormat": "blocknote-json"
}
```

Agent 修改已有文档时，流程应是：

```text
fetch document -> read contentMarkdown -> generate updated Markdown -> dry-run update -> user confirms -> commit
```

### 暂不开放的输入

暂不在 CLI / MCP / Skills 默认文档中开放：

```json
{
  "contentBlocks": []
}
```

如果未来开放，必须满足：

- 使用 `contentFormat: "blocknote-json"` 或 `inputFormat: "blocknote-json"` 显式声明。
- 只允许受控 block 类型。
- 服务端校验和归一化。
- dry-run 展示 Markdown/HTML 预览，而不是只展示 JSON。
- 默认关闭，仅内部或高级工具 feature flag 启用。

## Data Flow

```text
Agent generates Markdown
  -> CLI / MCP / Web Agent receives contentMarkdown
  -> dry-run returns Markdown preview and confirmationRequired
  -> user confirms
  -> Convex mutation receives contentMarkdown
  -> markdownToBlockNoteJson converts to BlockNote blocks
  -> documents.content stores BlockNote JSON string
  -> Web Editor reads JSON into BlockNote
  -> Mobile converts BlockNote JSON to HTML/TenTap view
  -> fetch/export returns contentMarkdown via blockNoteJsonToMarkdown
  -> Agent edits returned Markdown
  -> update append/overwrite repeats the same conversion path
```

## Edge Cases & Failure Modes

- 空内容：创建时允许无正文但标题必须非空；更新时至少 title 或 contentMarkdown 之一非空。
- 非法 Markdown：不应导致写入失败，应尽量降级为 paragraph。
- 未闭合代码块：按 code block 直到文末处理，或降级为 paragraph；需测试固定。
- 深层嵌套列表：首版可扁平化或有限支持，避免生成不兼容 children。
- HTML in Markdown：默认转义为文本，不执行原始 HTML，避免 XSS 和跨端不一致。
- 图片：短期只支持普通 Markdown 链接；图片写入需结合 EdgeStore 上传能力后再定义。
- 表格：短期可降级为 paragraph 或 code block；BlockNote 表格支持稳定前不承诺。
- Callout / toggle / columns：短期不支持；未来通过扩展 Markdown 指令或内部 blocks schema 增加。
- JSON 注入：即使 Markdown 内容看起来像 JSON，也按 Markdown 文本处理，不作为 BlockNote JSON 执行。
- BlockNote 独有结构：反向转换时优先保留文字和顺序，无法表达的 props 可丢弃，但不能导致读取失败。
- Agent 二次编辑：`overwrite` 前必须先 fetch，基于 `contentMarkdown` 生成新 Markdown；复杂结构无法无损时应提示用户风险。

## Assumptions & Decisions

- 假设外部 Agent 的主要目标是“可靠生成可读文档”，不是精确控制 BlockNote 内部布局。
- 假设 CLI / Skills / MCP 的对外兼容性优先级高于高级排版能力。
- 决策 `contentMarkdown` 是唯一默认写入输入，也是 Agent 默认读取和二次编辑视图。
- 决策 `documents.content` 继续存 BlockNote JSON string，不做数据库 schema 迁移。
- 决策 Markdown/BlockNote 双向转换器应尽量放在共享业务/Convex 可复用层，避免 Web、Mobile、CLI 各自实现。
- 决策高级 BlockNote JSON 输入暂不进入 M16 当前发布闭环。

## Rollout Plan

### Phase 1：文档决策落地

- 新增 `docs/agent-document-write-format-strategy.md`。
- 更新 `docs/README.md` 索引。
- 更新 M16 后续规划，标记格式策略已决策。
- 更新 progress 汇总。

### Phase 2：双向转换器增强

- 替换 `packages/convex/documents/logic/markdown.ts` 的简化实现。
- 增加双向转换器单测和 round-trip 测试。
- 确保 CLI/MCP/Web Agent 不需要改调用参数。

### Phase 3：Agent 指令和 Skill 同步

- 更新 Web Agent tool description。
- 更新 CLI README / Skills 文档。
- 运行 Skills 同步与漂移检查。

### Phase 4：端到端验证

- 用 CLI 创建包含标题、列表、代码块的文档。
- 用 MCP Client dry-run 和真实写入验证。
- 用 Web Editor 打开文档确认结构可编辑。
- 用 Mobile 读取同一文档确认兼容层不崩溃。

## Verification Steps

文档和 Skill：

```bash
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```

CLI / MCP：

```bash
pnpm --filter @mynotion/cli test
pnpm --filter @mynotion/cli typecheck
pnpm --filter @mynotion/cli build
pnpm e2e:mcp
pnpm e2e:mcp:client
```

Web / Convex：

```bash
pnpm --filter @notion/web exec convex codegen
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web build
```

必要时补充：

```bash
pnpm --filter @notion/web lint
```

## Acceptance Criteria

- 技术文档明确结论：默认选择 Markdown 读写视图，不让普通 Agent 直接生成或解析 BlockNote JSON。
- CLI / MCP / Skills / Web Agent 文档和 tool schema 中没有格式歧义。
- 转换器支持常用 Markdown 子集，并有单测覆盖。
- 反向转换器支持同一组高频 BlockNote block，并有 round-trip 测试覆盖。
- `docs create/import/update` 仍保持向后兼容。
- `docs fetch/export --format markdown` 返回适合 Agent 二次编辑的 Markdown。
- MCP 写工具仍默认 `dryRun: true`，dry-run 仍包含 `confirmationRequired: true`。
- 真实写入后的文档能在 Web BlockNote 编辑器打开，并能被 Mobile 兼容层读取。
- fetch/export 能返回可读 Markdown，满足 Agent 后续读取和增量更新。

## Open Questions

- 是否引入第三方 Markdown parser，还是先实现项目内轻量 parser？
  - 推荐：先评估 `micromark` / `mdast` 生态，若包体和 ESM 兼容可接受，优先用成熟 parser；否则实现受控轻量 parser。
- 是否把转换器从 `packages/convex` 移到 `packages/business/content-compat`？
  - 推荐：中期迁移到共享包，但需要确认 Convex runtime 是否能安全依赖该包及其依赖。
- 表格、图片、callout 是否进入第一版？
  - 推荐：不进入第一版；先支持高频结构，复杂结构后续用扩展语法或受控 blocks 能力。

## Final Recommendation

选择 **Markdown <-> BlockNote blocks 双向转换** 作为 Agent 读写文档主路径。

BlockNote JSON 应定位为 My-Notion 内部编辑器存储格式，而不是默认 Agent 生成或编辑协议。短期投入应集中在“可靠双向 Markdown 转换器 + 明确格式契约 + round-trip 测试覆盖 + 文档同步”上，这能在不破坏现有 CLI/MCP/Skills 能力的前提下，显著提升 Agent 读取、修改和写入文档质量。
