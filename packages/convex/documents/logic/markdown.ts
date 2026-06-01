type InlineStyle = {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
};

type BlockNoteInlineContent = {
  type: "text" | "link";
  text?: string;
  styles?: InlineStyle;
  content?: BlockNoteInlineContent[];
  href?: string;
};

type BlockNoteBlock = {
  type: string;
  props?: Record<string, unknown>;
  content?: string | BlockNoteInlineContent[];
  children?: BlockNoteBlock[];
};

const DEFAULT_TEXT_PROPS = {
  backgroundColor: "default",
  textColor: "default",
  textAlignment: "left",
};

function createTextBlock(
  type: string,
  text: string,
  props: Record<string, unknown> = {},
): BlockNoteBlock {
  return {
    type,
    props: { ...DEFAULT_TEXT_PROPS, ...props },
    content: parseInlineMarkdown(text),
    children: [],
  };
}

function createDividerBlock(): BlockNoteBlock {
  return {
    type: "divider",
    props: {},
    children: [],
  };
}

function pushText(
  result: BlockNoteInlineContent[],
  text: string,
  styles: InlineStyle = {},
) {
  if (!text) return;
  result.push({
    type: "text",
    text,
    styles,
  });
}

function findClosingMarker(text: string, marker: string, fromIndex: number) {
  const closingIndex = text.indexOf(marker, fromIndex);
  return closingIndex === -1 ? undefined : closingIndex;
}

function parseInlineMarkdown(text: string): BlockNoteInlineContent[] {
  const result: BlockNoteInlineContent[] = [];
  let index = 0;

  while (index < text.length) {
    const remaining = text.slice(index);

    if (remaining.startsWith("**")) {
      const closingIndex = findClosingMarker(text, "**", index + 2);
      if (closingIndex !== undefined) {
        pushText(result, text.slice(index + 2, closingIndex), { bold: true });
        index = closingIndex + 2;
        continue;
      }
    }

    if (remaining.startsWith("*")) {
      const closingIndex = findClosingMarker(text, "*", index + 1);
      if (closingIndex !== undefined) {
        pushText(result, text.slice(index + 1, closingIndex), { italic: true });
        index = closingIndex + 1;
        continue;
      }
    }

    if (remaining.startsWith("`")) {
      const closingIndex = findClosingMarker(text, "`", index + 1);
      if (closingIndex !== undefined) {
        pushText(result, text.slice(index + 1, closingIndex), { code: true });
        index = closingIndex + 1;
        continue;
      }
    }

    if (remaining.startsWith("[")) {
      const textEndIndex = text.indexOf("](", index);
      if (textEndIndex !== -1) {
        const hrefEndIndex = text.indexOf(")", textEndIndex + 2);
        if (hrefEndIndex !== -1) {
          result.push({
            type: "link",
            content: parseInlineMarkdown(text.slice(index + 1, textEndIndex)),
            href: text.slice(textEndIndex + 2, hrefEndIndex),
          });
          index = hrefEndIndex + 1;
          continue;
        }
      }
    }

    const nextSpecialIndex = ["**", "*", "`", "["]
      .map((marker) => text.indexOf(marker, index + 1))
      .filter((value) => value !== -1)
      .sort((left, right) => left - right)[0];
    const nextIndex = nextSpecialIndex ?? text.length;
    pushText(result, text.slice(index, nextIndex));
    index = nextIndex;
  }

  return result;
}

function inlineContentToMarkdown(content: BlockNoteBlock["content"]): string {
  if (!content) return "";
  if (typeof content === "string") return content;

  return content
    .map((part) => {
      if (part.type === "link") {
        const inner = inlineContentToMarkdown(part.content ?? []);
        return part.href ? `[${inner}](${part.href})` : inner;
      }

      let text = part.text ?? "";
      const styles = part.styles ?? {};
      if (styles.code) text = `\`${text}\``;
      if (styles.bold) text = `**${text}**`;
      if (styles.italic) text = `*${text}*`;
      return text;
    })
    .join("");
}

function isDivider(line: string) {
  return /^(---|\*\*\*|___)$/.test(line.trim());
}

function flushParagraph(blocks: BlockNoteBlock[], lines: string[]) {
  if (lines.length === 0) return;
  blocks.push(createTextBlock("paragraph", lines.join("\n")));
  lines.length = 0;
}

export function markdownToBlockNoteJson(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const blocks: BlockNoteBlock[] = [];
  const paragraphLines: string[] = [];
  let codeBlock: { language: string; lines: string[] } | undefined;

  for (const line of lines) {
    const codeFenceMatch = line.match(/^```([\w-]*)\s*$/);
    if (codeFenceMatch) {
      if (codeBlock) {
        blocks.push(createTextBlock("codeBlock", codeBlock.lines.join("\n"), {
          language: codeBlock.language || "plain",
        }));
        codeBlock = undefined;
      } else {
        flushParagraph(blocks, paragraphLines);
        codeBlock = { language: codeFenceMatch[1] ?? "plain", lines: [] };
      }
      continue;
    }

    if (codeBlock) {
      codeBlock.lines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph(blocks, paragraphLines);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(blocks, paragraphLines);
      blocks.push(createTextBlock("heading", headingMatch[2], {
        level: headingMatch[1].length,
      }));
      continue;
    }

    if (isDivider(line)) {
      flushParagraph(blocks, paragraphLines);
      blocks.push(createDividerBlock());
      continue;
    }

    const checkListMatch = line.match(/^[-*+]\s+\[( |x|X)\]\s+(.+)$/);
    if (checkListMatch) {
      flushParagraph(blocks, paragraphLines);
      blocks.push(createTextBlock("checkListItem", checkListMatch[2], {
        checked: checkListMatch[1].toLowerCase() === "x",
      }));
      continue;
    }

    const bulletListMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletListMatch) {
      flushParagraph(blocks, paragraphLines);
      blocks.push(createTextBlock("bulletListItem", bulletListMatch[1]));
      continue;
    }

    const numberedListMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedListMatch) {
      flushParagraph(blocks, paragraphLines);
      blocks.push(createTextBlock("numberedListItem", numberedListMatch[1]));
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      flushParagraph(blocks, paragraphLines);
      blocks.push(createTextBlock("quote", quoteMatch[1]));
      continue;
    }

    paragraphLines.push(line);
  }

  if (codeBlock) {
    blocks.push(createTextBlock("codeBlock", codeBlock.lines.join("\n"), {
      language: codeBlock.language || "plain",
    }));
  }
  flushParagraph(blocks, paragraphLines);

  return JSON.stringify(blocks.length ? blocks : [createTextBlock("paragraph", "")], null, 2);
}

function blockToMarkdown(block: BlockNoteBlock, index: number) {
  const text = inlineContentToMarkdown(block.content);
  switch (block.type) {
    case "heading": {
      const rawLevel = Number(block.props?.level ?? 1);
      const level = Math.min(Math.max(Number.isFinite(rawLevel) ? rawLevel : 1, 1), 6);
      return `${"#".repeat(level)} ${text}`;
    }
    case "bulletListItem":
      return `- ${text}`;
    case "numberedListItem":
      return `${index + 1}. ${text}`;
    case "checkListItem":
      return `- [${block.props?.checked ? "x" : " "}] ${text}`;
    case "quote":
      return text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "codeBlock": {
      const language = typeof block.props?.language === "string" ? block.props.language : "";
      return `\`\`\`${language === "plain" ? "" : language}\n${text}\n\`\`\``;
    }
    case "divider":
      return "---";
    default:
      return text;
  }
}

export function blockNoteJsonToMarkdown(content?: string) {
  if (!content) return "";

  try {
    const blocks = JSON.parse(content) as BlockNoteBlock[];
    if (!Array.isArray(blocks)) return content;

    return blocks
      .map((block, index) => blockToMarkdown(block, index))
      .filter((markdown) => markdown.trim().length > 0)
      .join("\n\n");
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
