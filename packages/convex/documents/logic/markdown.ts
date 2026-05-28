export function markdownToBlockNoteJson(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const blocks = lines.length > 0 ? lines : [""];

  return JSON.stringify(
    blocks.map((line) => ({
      type: "paragraph",
      content: line,
      children: [],
    })),
    null,
    2,
  );
}

export function blockNoteJsonToMarkdown(content?: string) {
  if (!content) return "";

  try {
    const blocks = JSON.parse(content) as Array<{
      content?: string | Array<{ text?: string }>;
    }>;

    return blocks
      .map((block) => {
        if (typeof block.content === "string") return block.content;
        if (Array.isArray(block.content)) {
          return block.content.map((part) => part.text ?? "").join("");
        }
        return "";
      })
      .join("\n");
  } catch {
    return content;
  }
}

export function appendMarkdownToBlockNoteJson(
  existingContent: string | undefined,
  markdown: string,
) {
  const existingBlocks = (() => {
    if (!existingContent) return [];
    try {
      const parsed = JSON.parse(existingContent);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const nextBlocks = JSON.parse(markdownToBlockNoteJson(markdown)) as unknown[];
  return JSON.stringify([...existingBlocks, ...nextBlocks], null, 2);
}
