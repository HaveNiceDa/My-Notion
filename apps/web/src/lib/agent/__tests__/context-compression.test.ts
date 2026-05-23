import { describe, it, expect } from "vitest";
import { compressContext } from "../context-compression";
import type OpenAI from "openai";

function createMockOpenAI(summary: string): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: summary } }],
        }),
      },
    },
  } as unknown as OpenAI;
}

// 生成超长消息列表，确保超过 MAX_CONTEXT_TOKENS (30000) 阈值
// 估算：chars/2 = tokens，需要 > 60000 chars
function generateLongMessages(count: number): OpenAI.ChatCompletionMessageParam[] {
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  const longContent = "这是一段很长的对话内容，用于测试上下文压缩功能。".repeat(100);
  for (let i = 0; i < count; i++) {
    messages.push({ role: "user", content: `用户消息 ${i + 1}: ${longContent}` });
    messages.push({ role: "assistant", content: `助手回复 ${i + 1}: ${longContent}` });
  }
  return messages;
}

describe("compressContext", () => {
  const model = "test-model";

  it("短消息列表不触发压缩", async () => {
    const messages = [
      { role: "user" as const, content: "你好" },
      { role: "assistant" as const, content: "你好！有什么可以帮你的？" },
    ];

    const result = await compressContext(createMockOpenAI("摘要"), model, messages);
    expect(result).toEqual(messages);
  });

  it("超长消息列表触发压缩，返回的消息数少于原始", async () => {
    const messages = generateLongMessages(20);

    const result = await compressContext(createMockOpenAI("对话摘要内容"), model, messages);
    expect(result.length).toBeLessThan(messages.length);
    expect(result[0].role).toBe("system");
    const sysContent = typeof result[0].content === "string" ? result[0].content : "";
    expect(sysContent).toContain("对话历史摘要");
  });

  it("压缩后保留最近的消息", async () => {
    const messages = generateLongMessages(20);

    const lastUserMsg = messages[messages.length - 2];
    const result = await compressContext(createMockOpenAI("摘要"), model, messages);
    expect(result[result.length - 2]).toEqual(lastUserMsg);
  });

  it("摘要失败时回退到截断", async () => {
    const messages = generateLongMessages(20);

    const failOpenAI = {
      chat: {
        completions: {
          create: async () => {
            throw new Error("API error");
          },
        },
      },
    } as unknown as OpenAI;

    const result = await compressContext(failOpenAI, model, messages);
    expect(result.length).toBeLessThan(messages.length);
    const hasSummary = result.some(
      (m) => m.role === "system" && typeof m.content === "string" && m.content.includes("对话历史摘要"),
    );
    expect(hasSummary).toBe(false);
  });
});
