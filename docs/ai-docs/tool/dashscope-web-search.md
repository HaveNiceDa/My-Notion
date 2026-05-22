# 阿里百炼 — 联网搜索

- **来源**: <https://help.aliyun.com/zh/model-studio/web-search>
- **更新时间**: 2026-05-21
- **适用场景**: Agent web_search tool 接入、实时信息查询、时效性问题回答

## 核心原理

大模型训练数据存在知识截止日期，无法回答实时问题。启用联网搜索后，模型可从网络获取实时数据，准确回答股票价格、天气预报、最新新闻等时效性问题。

## 三种 API 调用方式

| 方式 | 启用参数 | 说明 |
|---|---|---|
| Chat Completions API | `enable_search: true` | 最常用，项目当前使用此方式 |
| Responses API | `tools: [{ type: "web_search" }]` | 可配合 `web_extractor` + `code_interpreter` |
| DashScope 原生 | `enable_search: True` | Python SDK |

## 支持的模型

| 模型 | 联网搜索 |
|---|---|
| qwen3.7-max / qwen3.6-max-preview / qwen3-max | ✅ |
| qwen3.6-plus / qwen3.5-plus / qwen-plus | ✅ |
| qwen3.6-flash / qwen3.5-flash / qwen-flash | ✅ |
| qwen-turbo | ✅ |
| qwq-plus | ✅ |
| **deepseek-v4-pro** / deepseek-v4-flash / deepseek-v3.2 等 | ✅ |
| kimi (Moonshot-Kimi-K2-Instruct) | ✅ |
| MiniMax-M2.1 | ✅ |

> 2025 年 7 月后发布的千问 Max/Plus/Flash 模型都自动支持联网搜索。

## Node.js 示例（Chat Completions API）

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const completion = await openai.chat.completions.create({
  model: "qwen-plus",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "杭州明天天气如何" },
  ],
  enable_search: true,
});
```

## 搜索策略

| 策略 | 说明 | 适用场景 |
|---|---|---|
| `turbo`（默认） | 兼顾速度与效果 | 大多数场景 |
| `max` | 更全面的搜索，多源引擎 | 高精度研究、报告生成 |
| `agent` | 多轮检索与内容整合 | 复杂问题、英文场景 |
| `agent_max` | agent + 网页抓取 | 需要抓取网页内容的场景 |

```typescript
const completion = await openai.chat.completions.create({
  model: "qwen-plus",
  messages: [...],
  enable_search: true,
  search_options: {
    search_strategy: "max",
  },
});
```

## 进阶功能

| 功能 | Chat Completions API | DashScope API |
|---|---|---|
| 强制联网搜索 | ✅ | ✅ |
| 搜索量级策略 | ✅ | ✅ |
| 垂域搜索 | ✅ | ✅ |
| 搜索时效性 | ✅ | ✅ |
| 限定搜索来源站点 | ✅ | ✅ |
| 自然语言干预检索范围 | ✅ | ✅ |
| 返回搜索来源 | ❌ | ✅ |
| 角标引用标注 | ❌ | ✅ |

## 计费

联网搜索除模型推理费用外，`agent` / `agent_max` 策略每次调用额外收费。

## 项目中的对应关系

| 百炼概念 | 项目实现 |
|---|---|
| `enable_search` | 当前项目未接入联网搜索；ReAct 重构后可作为新 tool 注册 |
| 潜在接入方式 | 在 `AgentTool` definitions 中新增 `web_search` tool，或直接用 `enable_search` 参数 |
| 搜索策略 | 默认 `turbo`；研究类问题可切换 `max` 或 `agent` |
