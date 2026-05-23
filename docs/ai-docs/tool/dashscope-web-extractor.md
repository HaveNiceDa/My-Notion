# 阿里百炼 — 网页抓取

- **来源**: <https://help.aliyun.com/zh/model-studio/web-extractor>
- **更新时间**: 2026-05-21
- **适用场景**: Agent 访问指定 URL 提取内容、网页内容总结、技术文档解析

## 核心原理

大模型无法直接获取网页数据。网页抓取工具（web_extractor）可访问指定 URL 并提取内容，为大模型提供所需信息。

## 使用方式

### Chat Completions API（项目当前方式）

需同时开启联网搜索 + 思考模式，搜索策略设为 `agent_max`：

```typescript
const completion = await openai.chat.completions.create({
  model: "qwen3-max-2026-01-23",
  messages: [{ role: "user", content: "请访问xxx并总结" }],
  enable_thinking: true,
  enable_search: true,
  search_options: { search_strategy: "agent_max" },
  stream: true,
});
```

### Responses API

需同时添加 `web_search` + `web_extractor` + `code_interpreter`：

```typescript
const response = await openai.responses.create({
  model: "qwen3-max-2026-01-23",
  input: "请访问xxx并总结",
  tools: [
    { type: "web_search" },
    { type: "web_extractor" },
    { type: "code_interpreter" },
  ],
  enable_thinking: true,
});
```

## 支持的模型

### 推荐模型

| API | 模型 |
|---|---|
| Responses API | Qwen3.7-Max 系列 |
| Responses API | Qwen3.6-Plus / Qwen3.5-Plus 系列 |
| Chat Completions / DashScope | Qwen3-Max 系列（思考模式） |
| Chat Completions / DashScope | Qwen3.6-Plus / Qwen3.5-Plus 系列 |

### 其他模型（效果不如推荐模型）

- Qwen3.6-Flash / Qwen3.5-Flash
- Qwen3.6 开源（qwen3.6-27b 除外）
- Qwen3.5 开源

## 关键约束

| 约束 | 说明 |
|---|---|
| 必须开启思考模式 | `enable_thinking: true` |
| 必须同时开启联网搜索 | `enable_search: true`（Chat Completions）或 `web_search` tool（Responses API） |
| Chat Completions 搜索策略 | 必须为 `agent_max` |
| 仅支持流式输出 | 不支持非流式 |
| 建议同时开启 code_interpreter | 数学计算、数据分析场景效果更好 |

## 计费

| 项目 | 费用 |
|---|---|
| 模型调用 | 抓取的网页内容拼入 prompt，按标准 Token 价格计费 |
| 联网搜索 | 每 1000 次调用 4 元（中国内地） |
| 网页抓取 | 限时免费 |

## 项目中的对应关系

| 百炼概念 | 项目实现 |
|---|---|
| web_extractor | 当前项目未接入；可作为 Agent tool 扩展，让 AI 读取用户提供的 URL 内容 |
| agent_max 策略 | 当前项目联网搜索未启用；接入时需用 `agent_max` 策略 |
| 潜在接入点 | 用户在 AI Chat 中粘贴 URL 时自动触发网页抓取 |
