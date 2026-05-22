# 阿里百炼 — 上下文缓存（Context Cache）

- **来源**: <https://help.aliyun.com/zh/model-studio/context-cache>
- **更新时间**: 2026-05-21
- **适用场景**: 长对话 token 优化、ReAct 多轮迭代降低成本、system prompt 缓存

## 核心原理

不同推理请求可能出现输入内容的重叠（如多轮对话或对同一文档的多次提问）。上下文缓存技术缓存请求的公共前缀，减少重复计算，提升响应速度并降低成本。

## 两种缓存模式

| 维度 | 显式缓存 | 隐式缓存 |
|---|---|---|
| 开启方式 | 主动创建，需加 `cache_control` 标记 | 自动模式，无需配置，无法关闭 |
| 缓存命中率 | 确定性命中 | 不确定，系统自动识别公共前缀 |
| 创建缓存计费 | 输入 Token 单价的 125% | 输入 Token 单价的 100% |
| 命中缓存计费 | 输入 Token 单价的 10% | 输入 Token 单价的 20% |
| 最少 Token 数 | 1024 | 256 |
| 有效期 | 5 分钟（命中后重置） | 不确定，系统定期清理 |

> 两者互斥，单个请求只能应用其中一种。

## 显式缓存用法

在 messages 中加入 `cache_control` 标记：

```json
{
  "role": "system",
  "content": [
    {
      "type": "text",
      "text": "<长文本内容>",
      "cache_control": { "type": "ephemeral" }
    }
  ]
}
```

### 缓存命中机制

- 系统以每个 `cache_control` 标记位置为终点，向前回溯最多 20 个 content 块
- 单次请求最多 4 个缓存标记
- 有效期 5 分钟，命中后重置

### Node.js 示例

```typescript
const completion = await openai.chat.completions.create({
  model: "qwen3-coder-plus",
  messages: [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: longTextContent,
          cache_control: { type: "ephemeral" },
        },
      ],
    },
    { role: "user", content: userQuestion },
  ],
});

// 检查缓存命中情况
console.log(completion.usage?.prompt_tokens_details?.cached_tokens);
```

## 支持的模型

| 模型 | 显式缓存 |
|---|---|
| qwen3.7-max / qwen3.6-max-preview / qwen3-max | ✅ |
| qwen3.6-plus / qwen3.5-plus / qwen-plus | ✅ |
| qwen3.6-flash / qwen3.5-flash / qwen-flash | ✅ |
| qwen3-coder-plus / qwen3-coder-flash | ✅ |
| qwen3-vl-plus / qwen3-vl-flash | ✅ |
| deepseek-v3.2 | ✅ |
| kimi-k2.6 / kimi-k2.5 | ✅ |
| glm-5.1 | ✅ |

## Function Calling 缓存注意事项

工具定义会被序列化为 JSON 参与缓存计算，需确保每次请求的 tools 定义完全一致：

- 工具列表顺序一致
- 同一 tool 的 JSON 字段顺序一致
- 字段结构一致（不遗漏或新增字段）

## 限制

- 最小可缓存提示词长度：显式 1024 Token，隐式 256 Token
- 缓存标记间隔不超过 20 个 content 块
- 仅支持 `type: "ephemeral"`
- 单次请求最多 4 个缓存标记

## 项目中的对应关系

| 百炼概念 | 项目实现 |
|---|---|
| 隐式缓存 | 默认生效，无需配置；ReAct 多轮迭代中 system prompt 可能自动命中 |
| 显式缓存 | 当前未使用；可在 ReAct 循环中为 system message + tools 定义添加 `cache_control`，降低多轮迭代成本 |
| Function Calling 缓存 | 重构后 tools 定义标准化，每次请求一致，有利于缓存命中 |
