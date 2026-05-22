# 阿里百炼 — 多轮对话

- **来源**: <https://help.aliyun.com/zh/model-studio/multi-round-conversation>
- **更新时间**: 2026-04-23
- **适用场景**: Agent ReAct 循环中维护 messages 数组、tool call 多轮消息拼接、对话历史管理

## 核心原理

百炼 API 是无状态的，不会保存对话历史。实现多轮对话需要在每次请求中显式传入历史对话消息（`messages` 数组）。

### Messages 数组状态变化

```
第1轮: [user]
第2轮: [user, assistant, user]
第3轮: [user, assistant, user, assistant, user]
```

每轮对话都需要将用户的最新提问和模型的回复追加到 messages 数组中。

### 含 Tool Call 的多轮对话

```
messages: [
  { role: "user", content: "..." },
  { role: "assistant", content: null, tool_calls: [{...}] },  // 模型决定调 tool
  { role: "tool", tool_call_id: "xxx", content: "..." },      // tool 执行结果
  { role: "assistant", content: "最终回复" },                   // 模型基于 tool 结果回复
  { role: "user", content: "下一个问题" },                      // 用户继续提问
]
```

## Node.js 示例

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

async function getResponse(messages) {
  const completion = await openai.chat.completions.create({
    model: "qwen-plus",
    messages,
  });
  return completion.choices[0].message.content;
}

async function runConversation() {
  const messages = [];

  messages.push({ role: "user", content: "推荐一部关于太空探索的科幻电影。" });
  let output = await getResponse(messages);
  messages.push({ role: "assistant", content: output });

  messages.push({ role: "user", content: "这部电影的导演是谁？" });
  output = await getResponse(messages);
  messages.push({ role: "assistant", content: output });
}
```

## 上下文管理策略

| 策略 | 描述 | 适用场景 |
|---|---|---|
| **截断** | 只保留最近 N 轮对话 | 对话过长时控制 token |
| **摘要** | 用 LLM 对历史对话生成摘要，替换原始消息 | 需要保留语义但减少 token |
| **召回** | 基于当前问题检索相关历史片段 | 长对话中精准定位上下文 |

## 项目中的对应关系

| 百炼概念 | 项目实现 |
|---|---|
| messages 数组维护 | `useAIChat` hook 管理前端消息列表，发送时转为 `OpenAI.ChatCompletionMessageParam[]` |
| Tool call 多轮 | ReAct 循环中 `assistant.tool_calls` + `tool` 消息自动拼入 messages |
| 上下文截断 | 当前未实现，长对话可能超出 token 限制（待优化） |
