import { describe, expect, it } from "vitest";
import { splitDocumentForRag } from "../rag/utils";

describe("splitDocumentForRag", () => {
  it("按 BlockNote 标题结构切分并保留 heading metadata", async () => {
    const content = JSON.stringify([
      heading("产品设计", 1),
      paragraph("这里是产品设计的背景和目标。"),
      paragraph("这里是用户场景和边界。"),
      heading("实现方案", 2),
      paragraph("这里是实现方案的第一段。"),
      paragraph("这里是实现方案的第二段。"),
    ]);

    const chunks = await splitDocumentForRag(content);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].pageContent).toContain("# 产品设计");
    expect(chunks[0].metadata).toMatchObject({
      chunkStrategy: "heading",
      headingPath: "产品设计",
    });
    expect(chunks[1].pageContent).toContain("## 实现方案");
    expect(chunks[1].metadata.headingPath).toBe("产品设计 > 实现方案");
  });

  it("段落分明的长文按语义边界合并，不在每 250 字固定切断", async () => {
    const content = JSON.stringify([
      heading("长文", 1),
      paragraph("第一段".repeat(120)),
      paragraph("第二段".repeat(120)),
      paragraph("第三段".repeat(120)),
    ]);

    const chunks = await splitDocumentForRag(content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.pageContent.length <= 1200)).toBe(true);
    expect(chunks.some((chunk) => chunk.pageContent.includes("第二段"))).toBe(true);
    expect(chunks.some((chunk) => chunk.metadata.chunkStrategy === "semantic")).toBe(true);
  });

  it("非结构化纯文本退回固定大小加重叠策略", async () => {
    const content = "纯文本".repeat(400);

    const chunks = await splitDocumentForRag(content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.metadata.chunkStrategy === "fixed")).toBe(true);
    expect(chunks[0].metadata.blockTypes).toEqual(["text"]);
  });
});

function heading(text: string, level: number) {
  return {
    type: "heading",
    props: { level },
    content: [{ type: "text", text }],
    children: [],
  };
}

function paragraph(text: string) {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
    children: [],
  };
}
