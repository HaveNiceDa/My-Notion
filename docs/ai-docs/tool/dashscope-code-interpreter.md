# 阿里百炼 — 代码解释器

- **来源**: <https://help.aliyun.com/zh/model-studio/qwen-code-interpreter>
- **更新时间**: 2026-05-21
- **适用场景**: 数学计算、数据分析、复杂逻辑推理、Agent 代码执行能力

## 核心原理

启用内置的 Python 代码解释器后，模型可在沙箱环境中编写与运行 Python 代码，解决数学计算、数据分析等复杂问题。

### 执行流程

1. **思考** — 模型分析用户请求，生成解决问题的思路和步骤
2. **代码执行** — 模型生成并执行 Python 代码
3. **结果整合** — 模型接收代码执行结果，规划后续步骤
4. **回复** — 模型生成自然语言回复

> 第 2-3 步可能循环执行多次。

## 使用方式

### Chat Completions API（项目当前方式）

```typescript
const stream = await openai.chat.completions.create({
  model: "qwen3.6-plus",
  messages: [{ role: "user", content: "123的21次方是多少？" }],
  enable_thinking: true,
  enable_code_interpreter: true,
  stream: true,
});
```

### Responses API

```typescript
const response = await openai.responses.create({
  model: "qwen3.6-plus",
  input: "123的21次方是多少？",
  tools: [
    { type: "code_interpreter" },
    { type: "web_search" },
    { type: "web_extractor" },
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
| 仅支持流式输出 | 不支持非流式 |
| 沙箱环境 | 代码在沙箱中运行，无法访问外部网络或本地文件 |
| 建议同时开启 web_search + web_extractor | 获取最佳效果 |

## 返回字段差异

| API | 思考内容 | 代码执行 | 回复 |
|---|---|---|---|
| Responses API | `type="reasoning"` | `type="code_interpreter_call"` | `type="message"` |
| Chat Completions | `reasoning_content` | 不可见 | `content` |
| DashScope | `reasoning_content` | `tool_info.code_interpreter.code` | `content` |

## Node.js 示例（Chat Completions API）

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const stream = await openai.chat.completions.create({
  model: "qwen3.6-plus",
  messages: [{ role: "user", content: "123的21次方是多少？" }],
  enable_thinking: true,
  enable_code_interpreter: true,
  stream: true,
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  if (!delta) continue;

  if (delta.reasoning_content) {
    process.stdout.write(delta.reasoning_content);
  }
  if (delta.content) {
    process.stdout.write(delta.content);
  }
}
```

## 项目中的对应关系

| 百炼概念 | 项目实现 |
|---|---|
| code_interpreter | 当前项目未接入；可作为 Agent tool 扩展，让 AI 执行数学计算和数据分析 |
| 潜在接入方式 | Chat Completions API 中传 `enable_code_interpreter: true` |
| 适用场景 | 用户问数学计算、数据分析、图表生成等问题时自动触发 |
