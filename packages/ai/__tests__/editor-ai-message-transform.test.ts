import { describe, expect, it } from "vitest";
import {
  convertToOpenAIMessages,
  injectDocumentStateMessages,
} from "../server/editor-ai";

describe("editor AI message transform", () => {
  it("merges selected document state into the current user message", () => {
    const messages = [
      {
        role: "user",
        parts: [{ type: "text", text: "翻译成 英文" }],
        metadata: {
          documentState: {
            isEmptyDocument: false,
            selection: true,
            selectedBlocks: [
              {
                id: "fc3d2a09-bdaf-45ec-bd2f-bfca481f78ad$",
                block: "<p>今天天气真好啊</p>",
              },
            ],
            blocks: [
              { block: "<p>今天天气真好啊</p>" },
              { block: "<p></p>" },
            ],
          },
        },
      },
    ];

    const injectedMessages = injectDocumentStateMessages(messages);
    const openaiMessages = convertToOpenAIMessages(injectedMessages);

    expect(injectedMessages).toHaveLength(1);
    expect(openaiMessages).toHaveLength(1);
    expect(openaiMessages[0].role).toBe("user");

    const content = (openaiMessages[0] as { content: string }).content;
    expect(content).toContain("latest state of the selection");
    expect(content).toContain("fc3d2a09-bdaf-45ec-bd2f-bfca481f78ad$");
    expect(content).toContain("<p>今天天气真好啊</p>");
    expect(content).toContain("User request:");
    expect(content).toContain("翻译成 英文");
  });

  it("keeps user messages without document state unchanged", () => {
    const messages = [
      {
        role: "user",
        parts: [{ type: "text", text: "hello" }],
      },
    ];

    expect(injectDocumentStateMessages(messages)).toEqual(messages);
  });
});
