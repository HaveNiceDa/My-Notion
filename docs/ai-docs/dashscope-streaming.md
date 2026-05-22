# 阿里百炼 — 流式输出

- **来源**: <https://help.aliyun.com/zh/model-studio/stream>
- **更新时间**: 2026-04-23
- **适用场景**: Agent 流式响应实现、NDJSON 事件协议设计、streaming chunk 解析

## 核心原理

流式输出基于 SSE（Server-Sent Events）协议。发起流式请求后，服务端与客户端建立持久化 HTTP 连接，模型每生成一个文本块（chunk）立即推送。

### 流式 vs 非流式

| 维度 | 流式 | 非流式 |
|---|---|---|
| 响应方式 | 逐 chunk 推送 | 一次性返回全部内容 |
| 用户体验 | 实时逐字渲染 | 长时间等待 |
| 超时风险 | 低（持续推送） | 高（长时间无响应） |
| Token 用量 | 最后一个 chunk 包含 | 响应体直接包含 |

> ⚠️ Qwen3 开源版、QwQ、QVQ、Qwen-Omni 等模型**仅支持流式输出**。

## OpenAI 兼容模式 — Node.js

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const stream = await client.chat.completions.create({
  model: "qwen-plus",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "请介绍一下自己" },
  ],
  stream: true,
  stream_options: { include_usage: true },
});

const contentParts = [];
for await (const chunk of stream) {
  if (chunk.choices && chunk.choices.length > 0) {
    const content = chunk.choices[0]?.delta?.content || "";
    contentParts.push(content);
  } else if (chunk.usage) {
    console.log(`输入: ${chunk.usage.prompt_tokens}, 输出: ${chunk.usage.completion_tokens}`);
  }
}
```

## SSE 响应格式

```
data: {"choices":[{"delta":{"content":"","role":"assistant"},"index":0}],...}
data: {"choices":[{"delta":{"content":"我是"},"index":0}],...}
data: {"choices":[{"delta":{"content":"来自"},"index":0}],...}
data: {"choices":[{"finish_reason":"stop","delta":{"content":""},"index":0}],...}
data: {"choices":[],"usage":{"prompt_tokens":22,"completion_tokens":17,"total_tokens":39},...}
data: [DONE]
```

### Chunk 结构

```typescript
interface StreamChunk {
  choices: Array<{
    delta: {
      content?: string;           // 文本增量
      role?: string;              // 首个 chunk 包含 role
      tool_calls?: ToolCallDelta[]; // tool call 增量
      reasoning_content?: string;   // 思考过程增量（深度思考模式）
    };
    finish_reason: string | null; // "stop" | "tool_calls" | null
    index: number;
  }>;
  usage: TokenUsage | null;      // 仅最后一个 chunk 包含
  model: string;
  id: string;
}
```

## 关键参数

| 参数 | 说明 |
|---|---|
| `stream: true` | 开启流式输出 |
| `stream_options: { include_usage: true }` | 最后一个 chunk 包含 Token 用量（OpenAI 兼容模式） |
| `incremental_output: true` | 增量输出（DashScope 原生模式，推荐） |

### 增量 vs 非增量

| 模式 | 行为 | 示例 |
|---|---|---|
| 增量（推荐） | 每个 chunk 只包含新生成的内容 | `["我爱", "吃", "苹果"]` |
| 非增量 | 每个 chunk 包含之前已生成的全部内容 | `["我爱", "我爱吃", "我爱吃苹果"]` |

## 计费

流式输出计费规则与非流式完全相同，按 Token 用量计费。请求中断时，输出 Token 仅计算已生成部分。

## 项目中的对应关系

| 百炼概念 | 项目实现 |
|---|---|
| SSE 流式输出 | 项目使用自定义 NDJSON 协议（非标准 SSE），每个事件一行 JSON |
| `stream_options.include_usage` | 当前 `finish` 事件中 `usage: null`，未采集真实用量（待优化） |
| `delta.content` | 映射为 `text-delta` 事件 |
| `delta.reasoning_content` | 映射为 `reasoning-delta` 事件 |
| `delta.tool_calls` | 映射为 `tool-call-start` + `tool-call-delta` 事件 |
| `finish_reason: "tool_calls"` | ReAct 循环判断是否继续迭代的关键信号 |
