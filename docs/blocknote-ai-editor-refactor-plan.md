# BlockNote AI 编辑器重构建议

## 当前状态

编辑器 AI 和侧边栏 Agent 是两条独立链路：

| 维度 | 编辑器 AI | 侧边栏 Agent |
| --- | --- | --- |
| 入口 | `/api/editor-ai/streamText` | `/api/agent/stream` |
| 协议 | Vercel AI SDK `UIMessageStream` | 自定义 NDJSON |
| 模型调用 | 单轮编辑器 AI 请求 | ReAct Loop + tool 执行 |
| 上下文 | 当前文档块状态 | 对话消息、文档元数据、RAG/Memory |
| 写入方式 | BlockNote AI operation | Agent 写类 tool 预览/确认 |

编辑器 AI 的主要价值是“选区/局部内容编辑”，不应直接并入侧边栏 Agent，但两者应共享模型配置、安全边界、限流和 i18n 约定。

## 主要问题

| 问题 | 优先级 | 说明 |
| --- | --- | --- |
| 编辑器 AI route 职责过重 | P1 | 消息注入、OpenAI 格式转换、tool 转换、流式写入混在单个 route 中。 |
| 限流与错误边界不足 | P1 | 编辑器 AI 应复用 Web Agent 的限流和结构化错误处理思路。 |
| DashScope 兼容性 | P1 | `enable_thinking` 与显式 `tool_choice: auto` 组合可能触发兼容问题。 |
| 模型配置不统一 | P2 | 编辑器 AI 与 Chat/Agent 的模型配置来源需要收敛。 |
| i18n 和菜单项维护方式分散 | P2 | 自定义菜单项不应维护独立文案体系。 |
| 图标风格不统一 | P3 | emoji 图标与 BlockNote / shadcn 风格不一致。 |
| 单测不足 | P2 | 消息转换和流式 writer 适合抽为纯函数测试。 |

## 建议改造

### 1. 拆分 `/api/editor-ai/streamText`

建议结构：

```text
apps/web/src/app/api/editor-ai/streamText/
├── route.ts                 # auth、限流、参数校验、编排
├── message-transformer.ts   # 文档状态注入、OpenAI message 转换
├── tool-definitions.ts      # BlockNote tool 到 OpenAI tool 转换
├── stream-writer.ts         # UIMessageStream 写入和 tool 状态处理
└── system-prompt.ts         # 编辑器 AI system prompt
```

### 2. 统一安全和兼容性

- 给编辑器 AI 增加独立限流 key，例如 `editor-ai:${userId}`。
- 不在 DashScope thinking 模式下显式传递冲突的 `tool_choice`。
- 流式解析时过滤或隔离 reasoning 内容，避免混入编辑操作。
- 错误返回保持用户可读，不暴露上游 key、原始 token 或内部堆栈。

### 3. 收敛模型配置

- 将模型列表、默认模型、展示名和 provider 映射收敛到 `packages/ai/config`。
- Web Chat 模型选择和 Editor AI 后端都从共享配置读取。
- Editor AI 可以暂不暴露模型选择 UI，但后端应支持未来扩展。

### 4. 菜单项和 i18n

- 自定义菜单项保留在编辑器域内，但文案 key 放入 `packages/business/i18n`。
- 菜单项定义只保留 `key`、`prompt`、`requiresSelection`、`icon`、`titleKey`、`descriptionKey`。
- 图标优先使用项目已有 `lucide-react`，避免 emoji 风格割裂。

### 5. 测试

建议补充：

- message transformer 单测：文档状态注入、空内容、长内容压缩。
- tool definition 单测：BlockNote tool schema 到 OpenAI tool schema 转换。
- stream writer 单测：文本 delta、tool call、错误和 finish 事件。
- route smoke：未登录、限流、上游错误、正常流式返回。

## 建议优先级

1. P1：route 拆分、限流、DashScope 兼容性。
2. P2：模型配置统一、菜单 i18n、核心单测。
3. P3：图标规范化、自定义指令、操作历史、多轮编辑器 AI。

## 验证

```bash
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web test -- src/app/api/editor-ai src/components/editor
pnpm --filter @notion/web build
```
