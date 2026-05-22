# 阿里百炼 — Function Calling

- **来源**: <https://help.aliyun.com/zh/model-studio/qwen-function-calling>
- **更新时间**: 2026-05-21
- **适用场景**: Agent 工具调用、`/api/agent/stream` 路由开发、tool 定义与协议设计

## 工作原理

Function Calling 通过应用程序与大模型之间的多步骤交互实现：

1. **发起第一次模型调用** — 应用程序向大模型发送用户问题和可用工具清单。
2. **接收模型的工具调用指令** — 若模型判断需要调用外部工具，返回 JSON 格式的指令（函数名称与入参）；若无需调用，返回自然语言回复。
3. **在应用端运行工具** — 应用程序执行指定工具，获取输出结果。
4. **发起第二次模型调用** — 将工具输出结果添加到消息数组（messages），再次调用模型。
5. **接收来自模型的最终响应** — 模型综合工具输出与用户问题，生成自然语言回复。

## 支持的模型

| 厂商 | 模型系列 |
|---|---|
| 千问 | Qwen3.7-Max、Qwen3.6-Max/Plus/Flash、Qwen3-Max、Qwen-Max/Plus/Flash/Turbo、Qwen3-Coder、Qwen2.5-Coder、Qwen3.6/3.5/3/2.5 开源系列 |
| 千问多模态 | Qwen3-VL-Plus/Flash、Qwen3.5-Omni-Plus/Flash、Qwen3.5-Omni-Plus/Flash-Realtime |
| DeepSeek | deepseek-v4-pro、deepseek-v4-flash、deepseek-v3.2、deepseek-v3.1（非思考）、deepseek-r1、deepseek-r1-0528、deepseek-v3 |
| GLM | glm-5.1、glm-5、glm-4.7、glm-4.6、glm-4.5、glm-4.5-air |
| Kimi | kimi-k2.6、kimi-k2.5、kimi-k2-thinking、Moonshot-Kimi-K2-Instruct |
| MiniMax | MiniMax-M2.5、MiniMax-M2.1 |

## 关键兼容性约束

| 模型 | 约束 |
|---|---|
| **DeepSeek（思考模式）** | `enable_thinking` 开启时，禁止传递 `tool_choice` 为 `object`/`required`，否则 400 错误 |
| **Kimi（思考模式）** | 必须在每轮 assistant 消息中保留 `reasoning_content` 字段；`tool_choice` 仅支持 `"auto"` 和 `"none"` |

## OpenAI 兼容模式 — Node.js 示例

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const tools = [
  {
    type: "function",
    function: {
      name: "get_current_weather",
      description: "当你想查询指定城市的天气时非常有用。",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "城市或县区，比如北京市、杭州市、余杭区等。",
          },
        },
        required: ["location"],
      },
    },
  },
];

const getResponse = async (messages) => {
  return await openai.chat.completions.create({
    model: "qwen3.6-plus",
    enable_thinking: false,
    messages,
    tools,
  });
};

const main = async () => {
  let messages = [{ role: "user", content: "北京天气咋样" }];
  let response = await getResponse(messages);
  let assistantOutput = response.choices[0].message;
  if (!assistantOutput.content) assistantOutput.content = "";
  messages.push(assistantOutput);

  if (!assistantOutput.tool_calls) {
    console.log(`直接回复：${assistantOutput.content}`);
  } else {
    while (assistantOutput.tool_calls) {
      const toolCall = assistantOutput.tool_calls[0];
      const funcArgs = JSON.parse(toolCall.function.arguments);
      const toolResult = getCurrentWeather(funcArgs);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
      response = await getResponse(messages);
      assistantOutput = response.choices[0].message;
      if (!assistantOutput.content) assistantOutput.content = "";
      messages.push(assistantOutput);
    }
    console.log(`最终回复：${assistantOutput.content}`);
  }
};
```

## Tool 定义格式

```json
{
  "type": "function",
  "function": {
    "name": "tool_name",
    "description": "工具描述，帮助模型判断何时调用",
    "parameters": {
      "type": "object",
      "properties": {
        "param_name": {
          "type": "string",
          "description": "参数描述"
        }
      },
      "required": ["param_name"]
    }
  }
}
```

## 消息流格式

```
messages: [
  { role: "user", content: "用户问题" },
  { role: "assistant", tool_calls: [{ id, function: { name, arguments } }] },
  { role: "tool", tool_call_id: "xxx", content: "工具返回结果" },
  { role: "assistant", content: "最终自然语言回复" }
]
```

## 项目中的对应关系

| 百炼概念 | 项目实现 |
|---|---|
| Tool 定义 | `apps/web/src/app/api/agent/stream/route.ts` 中 `knowledge_search` / `document_read` |
| Tool 执行循环 | 同文件，后端直接执行 tool 后将结果拼入 messages 再调模型 |
| 流式输出 | 自定义 NDJSON 事件协议：`text-delta` / `tool-call-start` / `tool-call-result` / `finish` |
| 思考模式 | `enable_thinking` + `deepseek-v4-pro`，首轮不传 `tool_choice` object/required |
| OpenAI 兼容 | `base_url: dashscope.aliyuncs.com/compatible-mode/v1`，使用 OpenAI SDK |
