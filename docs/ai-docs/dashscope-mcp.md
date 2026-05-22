# 阿里百炼 — MCP (Model Context Protocol)

- **来源**: <https://help.aliyun.com/zh/model-studio/mcp>
- **更新时间**: 2026-05-09
- **适用场景**: 接入百炼托管 MCP 服务、扩展 Agent 外部工具能力、网页解析等第三方工具集成

## 概述

MCP（Model Context Protocol）可帮助大模型使用外部工具与数据，相比 Function Calling 更灵活且易于使用。通过 Responses API 接入，在 `tools` 参数中配置 MCP Server 信息。

## 与 Function Calling 的区别

| 维度 | Function Calling | MCP |
|---|---|---|
| 工具定义 | 应用端自行定义 tool schema | MCP Server 暴露工具列表，模型自动发现 |
| 灵活性 | 每次请求需显式传入 tools | 配置一次 MCP Server 即可使用其全部工具 |
| 协议 | OpenAI Chat Completions API | Responses API + SSE 协议 |
| 适用场景 | 自定义业务工具 | 接入第三方托管服务（网页解析、搜索等） |

## 支持的模型

| 模型系列 | 具体模型 |
|---|---|
| 千问 Plus | Qwen3.6-Plus 系列、Qwen3.5-Plus 系列 |
| 千问 Flash | Qwen3.6-Flash 系列、Qwen3.5-Flash 系列 |
| Qwen3.6 开源 | qwen3.6-27b **除外** |
| Qwen3.5 开源 | 全系列 |

> ⚠️ 仅支持通过 Responses API 调用，不支持 Chat Completions API。

## MCP 工具配置格式

```json
{
  "type": "mcp",
  "server_protocol": "sse",
  "server_label": "my-mcp-service",
  "server_description": "MCP 服务功能描述，帮助模型理解使用场景。",
  "server_url": "https://your-mcp-server-endpoint/sse",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN"
  }
}
```

### 参数说明

| 参数 | 必填 | 说明 |
|---|---|---|
| `type` | 是 | 固定为 `"mcp"` |
| `server_protocol` | 是 | 通信协议，当前仅支持 `"sse"` |
| `server_label` | 是 | MCP 服务标签名称，用于标识 |
| `server_description` | 否 | 功能描述，建议填写以提升模型调用准确性 |
| `server_url` | 是 | MCP 服务端点 URL |
| `headers` | 否 | 请求头，如 `Authorization` 认证信息 |

## Node.js 示例

### 非流式

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const mcpTool = {
  type: "mcp",
  server_protocol: "sse",
  server_label: "WebParser",
  server_description: "网页解析（WebParser）MCP 服务，一个专用于网页内容解析的工具包。",
  server_url: "https://dashscope.aliyuncs.com/api/v1/mcps/WebParser/sse",
  headers: {
    "Authorization": "Bearer " + process.env.DASHSCOPE_API_KEY,
  },
};

const response = await openai.responses.create({
  model: "qwen3.6-plus",
  input: "https://example.com 里有什么内容？",
  tools: [mcpTool],
});

console.log(response.output_text);
```

### 流式

```typescript
const stream = await openai.responses.create({
  model: "qwen3.6-plus",
  input: "https://example.com 里有什么内容？",
  tools: [mcpTool],
  stream: true,
});

for await (const event of stream) {
  if (event.type === "response.content_part.added") {
    console.log("[模型回复]");
  } else if (event.type === "response.output_text.delta") {
    process.stdout.write(event.delta);
  } else if (event.type === "response.completed") {
    const usage = event.response.usage;
    console.log(`\n[Token] 输入: ${usage.input_tokens}, 输出: ${usage.output_tokens}`);
  }
}
```

## 限制

- 最多添加 10 个 MCP Server
- 仅支持 SSE 协议的 MCP Server
- 仅支持 Responses API（非 Chat Completions API）

## 计费

- 模型推理费用：按 Token 用量计费
- MCP 服务费用：以各 MCP 服务的计费为准

## 项目中的对应关系

| 百炼 MCP 概念 | 项目现状 |
|---|---|
| Responses API | 当前项目使用 Chat Completions API + Function Calling，尚未接入 Responses API |
| MCP Server | 当前 `knowledge_search` / `document_read` 为自建 Function Calling tool |
| 潜在接入点 | 可通过 MCP 接入百炼托管服务（如 WebParser），替代自建网页解析能力 |
