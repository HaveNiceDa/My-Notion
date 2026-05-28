import OpenAI from "openai";

const MAX_CONTEXT_TOKENS = 30000;
const RECENT_USER_MESSAGES_TO_KEEP = 4;
const SUMMARY_MAX_TOKENS = 512;

// 粗略估算消息列表的 token 数
// 混合中英文场景：约 1 token / 2 字符
function estimateTokens(messages: OpenAI.ChatCompletionMessageParam[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      totalChars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") totalChars += part.text.length;
      }
    }
    if ("tool_calls" in msg && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if ("function" in tc) totalChars += tc.function.arguments.length;
      }
    }
  }
  return Math.ceil(totalChars / 2);
}

// 找到安全的切割点：保留最近 N 个 user 消息及其关联的 tool 消息链
// 返回切割索引，之前的消息可以被压缩
function findCutPoint(messages: OpenAI.ChatCompletionMessageParam[]): number {
  let userCount = 0;
  let cutIndex = 0;

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") {
      userCount++;
      if (userCount <= RECENT_USER_MESSAGES_TO_KEEP) {
        cutIndex = i;
      }
    }
  }

  // 如果 user 消息不够，不需要压缩
  if (userCount <= RECENT_USER_MESSAGES_TO_KEEP) return messages.length;

  // 向前回溯，确保不在 tool 消息链中间切割
  // tool 消息必须紧跟在带 tool_calls 的 assistant 消息之后
  while (cutIndex > 0) {
    const msg = messages[cutIndex];
    if (msg.role === "tool") {
      cutIndex--;
      continue;
    }
    // 如果是带 tool_calls 的 assistant 消息，继续向前
    if (msg.role === "assistant" && "tool_calls" in msg && msg.tool_calls && msg.tool_calls.length > 0) {
      cutIndex--;
      continue;
    }
    break;
  }

  return cutIndex;
}

// 用 LLM 摘要旧消息，返回一条 system 消息替代它们
async function summarizeMessages(
  openai: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
): Promise<OpenAI.ChatCompletionSystemMessageParam> {
  const conversationText = messages
    .map((msg) => {
      const role = msg.role;
      let content = "";
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content
          .filter((p) => p.type === "text")
          .map((p) => ("text" in p ? p.text : ""))
          .join(" ");
      }
      if ("tool_calls" in msg && msg.tool_calls) {
        const toolInfo = msg.tool_calls
          .filter((tc): tc is OpenAI.ChatCompletionMessageFunctionToolCall => "function" in tc)
          .map((tc) => `[调用工具: ${tc.function.name}]`)
          .join(", ");
        content = content ? `${content} ${toolInfo}` : toolInfo;
      }
      if (msg.role === "tool") {
        const toolId = "tool_call_id" in msg ? msg.tool_call_id : "";
        content = `[工具结果 ${toolId}]: ${content}`;
      }
      return `${role}: ${content}`;
    })
    .join("\n");

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "你是一个对话摘要助手。请用简洁的中文总结以下对话的关键信息，保留重要的事实、决策、用户偏好和上下文。摘要应能让 AI 助手无缝继续对话。不要添加对话中没有的信息。",
      },
      { role: "user", content: conversationText },
    ],
    max_tokens: SUMMARY_MAX_TOKENS,
    stream: false,
  });

  const summary = response.choices[0]?.message?.content || "（对话历史摘要不可用）";

  return {
    role: "system",
    content: `[对话历史摘要] ${summary}`,
  };
}

// 压缩对话上下文：当 token 估算超阈值时，摘要旧消息 + 保留最近 N 轮
export async function compressContext(
  openai: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
): Promise<OpenAI.ChatCompletionMessageParam[]> {
  const estimatedTokens = estimateTokens(messages);
  if (estimatedTokens <= MAX_CONTEXT_TOKENS) {
    return messages;
  }

  const cutIndex = findCutPoint(messages);
  if (cutIndex === 0 || cutIndex >= messages.length) {
    return messages;
  }

  const oldMessages = messages.slice(0, cutIndex);
  const recentMessages = messages.slice(cutIndex);

  debugLog(
    `[ContextCompression] 估算 ${estimatedTokens} tokens > ${MAX_CONTEXT_TOKENS}，压缩前 ${cutIndex} 条消息`,
  );

  try {
    const summaryMessage = await summarizeMessages(openai, model, oldMessages);
    const compressed = [summaryMessage, ...recentMessages];
    const newTokens = estimateTokens(compressed);
    debugLog(
      `[ContextCompression] 压缩完成: ${messages.length} → ${compressed.length} 条消息，${estimatedTokens} → ${newTokens} tokens`,
    );
    return compressed;
  } catch (error) {
    console.error("[ContextCompression] 摘要失败，回退到截断:", error);
    // 摘要失败时回退：直接截断旧消息，仅保留最近部分
    return recentMessages;
  }
}

function debugLog(message: string): void {
  if (process.env.AGENT_DEBUG_LOG === "1" || process.env.AGENT_DEBUG_LOG === "true") {
    console.log(message);
  }
}
