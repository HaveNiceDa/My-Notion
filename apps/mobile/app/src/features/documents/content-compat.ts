type BlockNoteInlineContent = {
  type?: string;
  text?: string;
  content?: BlockNoteInlineContent[];
  children?: BlockNoteBlock[];
};

type BlockNoteBlock = {
  id?: string;
  type?: string;
  content?: BlockNoteInlineContent[];
  children?: BlockNoteBlock[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createBlockId(index: number) {
  return `mobile-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractInlineText(nodes: BlockNoteInlineContent[] | undefined): string {
  if (!nodes?.length) return "";

  return nodes
    .map((node) => {
      if (node.type === "text") {
        return node.text ?? "";
      }

      if (node.content) {
        return extractInlineText(node.content);
      }

      return "";
    })
    .join("");
}

function extractBlocksText(blocks: BlockNoteBlock[]): string {
  return blocks
    .map((block) => {
      const current = extractInlineText(block.content);
      const children = block.children?.length ? extractBlocksText(block.children) : "";

      return [current, children].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function isBlockNoteDocumentString(content?: string | null) {
  if (!content) return false;

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) && parsed.every((item) => isRecord(item));
  } catch {
    return false;
  }
}

export function getPlainTextFromStoredContent(content?: string | null) {
  if (!content) return "";

  if (isBlockNoteDocumentString(content)) {
    try {
      const parsed = JSON.parse(content) as BlockNoteBlock[];
      return extractBlocksText(parsed);
    } catch {
      return "";
    }
  }

  if (content.includes("<") && content.includes(">")) {
    return stripHtml(content);
  }

  return content;
}

export function getEditorContentFromStoredContent(content?: string | null) {
  const plainText = getPlainTextFromStoredContent(content);

  if (!plainText.trim()) {
    return "<p></p>";
  }

  return plainText
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export function serializePlainTextToBlockNote(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return JSON.stringify(
      [
          {
          id: createBlockId(0),
          type: "paragraph",
          props: {
            backgroundColor: "default",
            textColor: "default",
            textAlignment: "left",
          },
          content: [],
          children: [],
        },
      ],
      null,
      2,
    );
  }

  const paragraphs = normalized.split(/\n{2,}/);
  const blocks = paragraphs.map((paragraph, paragraphIndex) => ({
    id: createBlockId(paragraphIndex),
    type: "paragraph",
    props: {
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
    },
    content: paragraph.split("\n").flatMap((line, lineIndex, lines) => {
      const nodes: { type: string; text?: string }[] = [];

      if (line.length > 0) {
        nodes.push({ type: "text", text: line });
      }

      if (lineIndex < lines.length - 1) {
        nodes.push({ type: "text", text: "\n" });
      }

      return nodes;
    }),
    children: [],
  }));

  return JSON.stringify(blocks, null, 2);
}
