import { describe, expect, it } from "vitest";
import { extractTextFromDocument } from "../utils/extract-text";

describe("extractTextFromDocument", () => {
  it("includes whiteboard custom blocks as stable references", () => {
    const content = JSON.stringify([
      {
        id: "paragraph-1",
        type: "paragraph",
        content: [{ type: "text", text: "正文" }],
        children: [],
      },
      {
        id: "whiteboard-block-1",
        type: "whiteboard",
        props: {
          whiteboardId: "wb_123",
          title: "系统架构图",
          engine: "excalidraw",
        },
        content: [],
        children: [],
      },
    ]);

    expect(extractTextFromDocument(content)).toContain(
      "![My-Notion Whiteboard: 系统架构图](mynotion-whiteboard://wb_123)",
    );
  });
});
