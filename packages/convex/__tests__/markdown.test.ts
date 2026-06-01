import { describe, expect, it } from "vitest";
import {
  appendMarkdownToBlockNoteJson,
  blockNoteJsonToMarkdown,
  markdownToBlockNoteJson,
} from "../documents/logic/markdown";

type TestBlock = {
  type: string;
  props?: Record<string, unknown>;
  content?: Array<{
    type: string;
    text?: string;
    styles?: Record<string, unknown>;
    content?: unknown[];
    href?: string;
  }>;
};

function parseBlocks(markdown: string) {
  return JSON.parse(markdownToBlockNoteJson(markdown)) as TestBlock[];
}

describe("markdown BlockNote conversion", () => {
  it("converts common Markdown blocks to BlockNote blocks", () => {
    const blocks = parseBlocks(`# Title

Paragraph with **bold**, *italic*, \`code\`, and [link](https://example.com).

- Bullet
1. Numbered
- [x] Done
> Quote

\`\`\`ts
const value = 1;
\`\`\`

---`);

    expect(blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
      "bulletListItem",
      "numberedListItem",
      "checkListItem",
      "quote",
      "codeBlock",
      "divider",
    ]);
    expect(blocks[0].props?.level).toBe(1);
    expect(blocks[4].props?.checked).toBe(true);
    expect(blocks[6].props?.language).toBe("ts");
    expect(blocks[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "bold", styles: { bold: true } }),
        expect.objectContaining({ text: "italic", styles: { italic: true } }),
        expect.objectContaining({ text: "code", styles: { code: true } }),
        expect.objectContaining({ type: "link", href: "https://example.com" }),
      ]),
    );
  });

  it("serializes BlockNote blocks back to editable Markdown", () => {
    const json = JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "Plan", styles: {} }],
        children: [],
      },
      {
        type: "bulletListItem",
        props: {},
        content: [{ type: "text", text: "Item", styles: {} }],
        children: [],
      },
      {
        type: "checkListItem",
        props: { checked: true },
        content: [{ type: "text", text: "Done", styles: {} }],
        children: [],
      },
      {
        type: "codeBlock",
        props: { language: "ts" },
        content: [{ type: "text", text: "const x = 1;", styles: {} }],
        children: [],
      },
    ]);

    expect(blockNoteJsonToMarkdown(json)).toBe(
      [
        "## Plan",
        "- Item",
        "- [x] Done",
        "```ts\nconst x = 1;\n```",
      ].join("\n\n"),
    );
  });

  it("round-trips Markdown high-frequency structure", () => {
    const markdown = `# Title

- First
- [ ] Todo

\`\`\`js
console.log("ok");
\`\`\``;

    const roundTrip = blockNoteJsonToMarkdown(markdownToBlockNoteJson(markdown));

    expect(roundTrip).toContain("# Title");
    expect(roundTrip).toContain("- First");
    expect(roundTrip).toContain("- [ ] Todo");
    expect(roundTrip).toContain("```js\nconsole.log(\"ok\");\n```");
  });

  it("appends Markdown without dropping existing blocks", () => {
    const existing = markdownToBlockNoteJson("# Existing");
    const appended = JSON.parse(
      appendMarkdownToBlockNoteJson(existing, "## Next"),
    ) as TestBlock[];

    expect(appended.map((block) => block.type)).toEqual(["heading", "heading"]);
    expect(appended[0].props?.level).toBe(1);
    expect(appended[1].props?.level).toBe(2);
  });
});
