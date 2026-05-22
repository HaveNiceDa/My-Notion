# 阿里百炼 — 深度思考

- **来源**: <https://help.aliyun.com/zh/model-studio/deep-thinking>
- **更新时间**: 2026-05-18
- **适用场景**: Agent thinking mode 开关、`enable_thinking` 参数配置、`reasoning_content` 解析、模型兼容性排查

## 核心原理

深度思考模型在生成回复前先进行推理（Chain of Thought），从而在逻辑推理、数学计算等复杂任务中提升准确性。

### 两种思考模式

| 模式 | 说明 | 控制方式 |
|---|---|---|
| **混合思考模式** | 可通过参数开关思考 | `enable_thinking: true/false` |
| **仅思考模式** | 始终思考，无法关闭 | 无需设置 `enable_thinking` |

### 输出字段

| 字段 | 说明 |
|---|---|
| `reasoning_content` | 思考过程（流式增量返回） |
| `content` | 最终回复内容 |

## 支持的模型

### 混合思考模式（可通过参数开关）

| 模型 | 默认状态 |
|---|---|
| qwen3.6-max-preview | **默认开启** |
| qwen3.6-plus / qwen3.6-plus-2026-04-02 | **默认开启** |
| qwen3.6-flash / qwen3.6-flash-2026-04-16 | **默认开启** |
| qwen3.5-plus / qwen3.5-flash | **默认开启** |
| qwen3.6-35b-a3b | **默认开启** |
| **deepseek-v4-pro** / deepseek-v4-flash | **默认开启** |
| deepseek-v3.2 / deepseek-v3.1 | 默认关闭 |
| qwen3-max / qwen3-max-preview | 默认关闭 |
| qwen-plus / qwen-flash / qwen-turbo | 默认关闭 |
| glm-5.1 / glm-5 / glm-4.7 / glm-4.6 / glm-4.5 | **默认开启** |
| kimi-k2.6 / kimi-k2.5（百炼部署） | 默认关闭 |

### 仅思考模式（无法关闭）

| 模型 |
|---|
| qwq-plus / qwq-32b |
| deepseek-r1 / deepseek-r1-0528 |
| kimi-k2-thinking |
| MiniMax-M2.5 / MiniMax-M2.1 |

## Node.js 示例

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const stream = await openai.chat.completions.create({
  model: "qwen-plus",
  messages: [{ role: "user", content: "你是谁" }],
  stream: true,
  enable_thinking: true,
});

let reasoningContent = "";
let answerContent = "";
let isAnswering = false;

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  if (!delta) continue;

  if (delta.reasoning_content != null) {
    reasoningContent += delta.reasoning_content;
  }

  if (delta.content) {
    if (!isAnswering) isAnswering = true;
    answerContent += delta.content;
  }
}
```

## OpenAI 兼容模式参数

```typescript
// enable_thinking 非 OpenAI 标准参数，需通过 extra_body 传入（Python）
// Node.js SDK 可直接传 enable_thinking
const params = {
  model: "qwen-plus",
  messages: [...],
  stream: true,
  enable_thinking: true,           // Node.js SDK
  // extra_body: { enable_thinking: true },  // Python SDK
  stream_options: { include_usage: true },
};
```

## 关键兼容性约束

| 模型 | 约束 |
|---|---|
| **DeepSeek（思考模式）** | `enable_thinking` 开启时，禁止传递 `tool_choice` 为 `object`/`required`，否则 400 错误 |
| **Kimi（思考模式）** | 必须在每轮 assistant 消息中保留 `reasoning_content` 字段；`tool_choice` 仅支持 `"auto"` 和 `"none"` |
| **默认开启的模型** | 如 deepseek-v4-pro，不传 `enable_thinking` 也会思考；需显式传 `enable_thinking: false` 关闭 |
| **仅思考模式模型** | 如 deepseek-r1，不支持 `enable_thinking: false`，始终返回 `reasoning_content` |

## 流式响应中的思考内容

```
data: {"choices":[{"delta":{"content":null,"role":"assistant","reasoning_content":""}},...]}
data: {"choices":[{"delta":{"reasoning_content":"好的，用户问..."}},...]}
data: {"choices":[{"delta":{"reasoning_content":"首先我要..."}},...]}
data: {"choices":[{"delta":{"content":"你好！","reasoning_content":null}},...]}
data: {"choices":[{"finish_reason":"stop","delta":{"content":"","reasoning_content":null}},...]}
data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":360,"total_tokens":370},...}
data: [DONE]
```

- `reasoning_content` 先输出（思考阶段）
- `content` 后输出（回复阶段）
- 两者互斥：同一 chunk 不会同时包含非空的 `reasoning_content` 和 `content`

## 项目中的对应关系

| 百炼概念 | 项目实现 |
|---|---|
| `enable_thinking` | 前端 deep thinking 开关 → `AgentRequestBody.enableThinking` |
| `reasoning_content` | 映射为 `reasoning-delta` NDJSON 事件 |
| `content` | 映射为 `text-delta` NDJSON 事件 |
| `extra_body` | `createThinkingBody()` 构造 `{ enable_thinking: true, thinking_budget: 50 }` |
| DeepSeek tool_choice 冲突 | ReAct 重构后 `tool_choice` 始终为 `"auto"`，自动规避 |
| 默认开启思考的模型 | `deepseek-v4-pro` 为项目默认模型，默认开启思考 |
