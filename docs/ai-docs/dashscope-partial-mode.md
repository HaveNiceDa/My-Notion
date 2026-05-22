# 阿里百炼 — 指定前缀续写（Partial Mode）

- **来源**: <https://help.aliyun.com/zh/model-studio/partial-mode>
- **更新时间**: 2026-05-21
- **适用场景**: 代码补全、文本续写、编辑器 AI 辅助、截断内容续写

## 核心原理

在 messages 数组中将最后一条消息的 `role` 设为 `assistant`，并在 `content` 中提供前缀，设置 `"partial": true`，模型会从前缀内容为起点继续生成。

```json
[
  { "role": "user", "content": "请补全这个斐波那契函数" },
  { "role": "assistant", "content": "def calculate_fibonacci(n):\n    if n <= 1:\n        return n\n    else:\n", "partial": true }
]
```

## 支持的模型

| 类型 | 模型 |
|---|---|
| 千问 Max/Plus/Flash/Turbo | 非思考模式下可用 |
| 千问 Coder | Qwen3-Coder、Qwen2.5-Coder、Qwen-Coder |
| 千问开源 | Qwen3.6/3.5/3/2.5（非思考模式） |
| 千问 Math | Qwen-Math、Qwen2.5-Math |
| 千问 VL | Qwen3-VL-Plus/Flash、Qwen-VL-Max/Plus |
| DeepSeek | siliconflow/vanchin 部署的部分模型 |
| Kimi | kimi/kimi-k2.6、kimi/kimi-k2.5 |

> ⚠️ 思考模式下不可用，需关闭 `enable_thinking`。

## Node.js 示例

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

const prefix = `def calculate_fibonacci(n):
    if n <= 1:
        return n
    else:
`;

const completion = await openai.chat.completions.create({
  model: "qwen3-coder-plus",
  messages: [
    { role: "user", content: "请补全这个斐波那契函数，勿添加其它内容" },
    { role: "assistant", content: prefix, partial: true },
  ],
});

const completeCode = prefix + completion.choices[0].message.content;
```

## 使用场景

| 场景 | 说明 |
|---|---|
| 代码补全 | 编辑器中用户已写部分代码，模型补全剩余部分 |
| 文案续写 | 给定开头，模型续写完整文案 |
| 截断续写 | `max_tokens` 过小或超时导致输出不完整，用 Partial Mode 续写 |
| 多模态前缀 | 千问 VL 支持图片 + 文本前缀续写 |

## 项目中的对应关系

| 百炼概念 | 项目实现 |
|---|---|
| Partial Mode | 当前项目未使用；编辑器 AI 走 `@blocknote/xl-ai`，未接入 Partial Mode |
| 潜在接入点 | BlockNote 编辑器 AI 补全可考虑用 Partial Mode 替代当前方案 |
