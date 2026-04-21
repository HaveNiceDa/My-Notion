type BlockNoteInlineContent = {
  type?: string;
  text?: string;
  styles?: Record<string, unknown>;
  content?: BlockNoteInlineContent[];
  href?: string;
  children?: BlockNoteBlock[];
};

type BlockNoteBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: BlockNoteInlineContent[];
  children?: BlockNoteBlock[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
      return extractBlocksText(JSON.parse(content) as BlockNoteBlock[]);
    } catch {
      return "";
    }
  }

  if (content.includes("<") && content.includes(">")) {
    return content
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return content;
}

function inlineContentToHtml(nodes: BlockNoteInlineContent[]): string {
  return nodes
    .map((node) => {
      if (node.type === "link" && node.href) {
        const inner = node.content ? inlineContentToHtml(node.content) : "";
        return `<a href="${escapeAttr(node.href)}">${inner}</a>`;
      }

      const text = node.text ?? "";
      let html = escapeHtml(text);

      const s = node.styles ?? {};
      if (s.bold) html = `<strong>${html}</strong>`;
      if (s.italic) html = `<em>${html}</em>`;
      if (s.underline) html = `<u>${html}</u>`;
      if (s.strikethrough) html = `<s>${html}</s>`;
      if (s.code) html = `<code>${html}</code>`;

      return html;
    })
    .join("");
}

function blockToHtml(block: BlockNoteBlock, indent: string = ""): string {
  const tag = blockTypeToHtmlTag(block.type, block.props);
  const inlineHtml = block.content ? inlineContentToHtml(block.content) : "";
  const childrenHtml = block.children?.length
    ? "\n" + block.children.map((c) => blockToHtml(c, indent + "  ")).join("\n") + "\n" + indent
    : "";

  if (block.type === "divider") {
    return `${indent}<hr>`;
  }

  if (block.type === "codeBlock") {
    const lang = (block.props?.language as string) || "";
    const codeText = extractInlineText(block.content);
    return `${indent}<pre><code${lang ? ` class="language-${escapeAttr(lang)}"` : ""}>${escapeHtml(codeText)}</code></pre>`;
  }

  return `${indent}<${tag}>${inlineHtml}${childrenHtml}</${tag}>`;
}

function blockTypeToHtmlTag(type?: string, props?: Record<string, unknown>): string {
  switch (type) {
    case "heading": {
      const level = (props?.level as number) || 1;
      return `h${Math.min(Math.max(level, 1), 6)}`;
    }
    case "bulletListItem": return "li";
    case "numberedListItem": return "li";
    case "checkListItem": return "li";
    case "quote": return "blockquote";
    case "codeBlock": return "pre";
    default: return "p";
  }
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function blockNoteJsonToHtml(json: BlockNoteBlock[]): string {
  if (!json.length) return "<p></p>";

  const htmlParts: string[] = [];
  let i = 0;

  while (i < json.length) {
    const block = json[i];

    if (block.type === "bulletListItem") {
      const items = collectListItems(json, i, "bulletListItem");
      htmlParts.push(`<ul>${items.map((b) => blockToHtml(b, "  ")).join("\n")}</ul>`);
      i += items.length;
    } else if (block.type === "numberedListItem") {
      const items = collectListItems(json, i, "numberedListItem");
      htmlParts.push(`<ol>${items.map((b) => blockToHtml(b, "  ")).join("\n")}</ol>`);
      i += items.length;
    } else if (block.type === "checkListItem") {
      const items = collectListItems(json, i, "checkListItem");
      htmlParts.push(`<ul>${items.map((b) => {
        const checked = b.props?.checked ? ' data-checked="true"' : "";
        return `<li${checked}>${b.content ? inlineContentToHtml(b.content) : ""}</li>`;
      }).join("\n")}</ul>`);
      i += items.length;
    } else {
      htmlParts.push(blockToHtml(block));
      i++;
    }
  }

  return htmlParts.join("\n");
}

function collectListItems(blocks: BlockNoteBlock[], startIndex: number, listType: string): BlockNoteBlock[] {
  const items: BlockNoteBlock[] = [];
  let i = startIndex;
  while (i < blocks.length && blocks[i].type === listType) {
    items.push(blocks[i]);
    i++;
  }
  return items;
}

export function getEditorContentFromStoredContent(content?: string | null) {
  if (!content) return "<p></p>";

  if (isBlockNoteDocumentString(content)) {
    try {
      return blockNoteJsonToHtml(JSON.parse(content) as BlockNoteBlock[]);
    } catch {
      return "<p></p>";
    }
  }

  if (content.trim().startsWith("<") && content.trim().endsWith(">")) {
    return content;
  }

  const plainText = content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");

  if (!plainText.trim()) return "<p></p>";

  return plainText
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

interface HtmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
  text?: string;
}

function parseHtmlToNodes(html: string): HtmlNode[] {
  const root: HtmlNode[] = [];
  const stack: { node: HtmlNode; parent: HtmlNode[] }[] = [];
  let currentList: HtmlNode[] = root;
  let pos = 0;

  const selfClosingTags = new Set(["br", "hr", "img"]);

  while (pos < html.length) {
    const openTag = html.indexOf("<", pos);

    if (openTag === -1) {
      const text = html.slice(pos).trim();
      if (text) {
        appendText(currentList, decodeHtmlEntities(text));
      }
      break;
    }

    if (openTag > pos) {
      const text = html.slice(pos, openTag);
      if (text.trim()) {
        appendText(currentList, decodeHtmlEntities(text));
      }
    }

    const closeBracket = html.indexOf(">", openTag);
    if (closeBracket === -1) break;

    const tagContent = html.slice(openTag + 1, closeBracket).trim();

    if (tagContent.startsWith("/")) {
      const closingTag = tagContent.slice(1).split(/\s/)[0].toLowerCase();
      pos = closeBracket + 1;

      if (stack.length > 0 && stack[stack.length - 1].node.tag === closingTag) {
        stack.pop();
        currentList = stack.length > 0 ? stack[stack.length - 1].node.children : root;
      }
      continue;
    }

    const { tag, attrs } = parseTag(tagContent);
    pos = closeBracket + 1;

    if (selfClosingTags.has(tag) || tagContent.endsWith("/")) {
      if (tag === "br") {
        appendText(currentList, "\n");
      } else if (tag === "hr") {
        currentList.push({ tag: "hr", attrs, children: [] });
      }
      continue;
    }

    const node: HtmlNode = { tag, attrs, children: [] };
    currentList.push(node);
    stack.push({ node, parent: currentList });
    currentList = node.children;
  }

  return root;
}

function parseTag(tagContent: string): { tag: string; attrs: Record<string, string> } {
  const parts = tagContent.match(/^(\w+)(.*)/);
  if (!parts) return { tag: tagContent.toLowerCase(), attrs: {} };

  const tag = parts[1].toLowerCase();
  const attrs: Record<string, string> = {};
  const attrRegex = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let match;
  const attrStr = parts[2].trim();
  while ((match = attrRegex.exec(attrStr)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? "";
    if (key !== tag) attrs[key] = val;
  }

  return { tag, attrs };
}

function appendText(list: HtmlNode[], text: string) {
  if (!text) return;
  const last = list[list.length - 1];
  if (last && last.tag === "_text") {
    last.text = (last.text ?? "") + text;
  } else {
    list.push({ tag: "_text", attrs: {}, children: [], text });
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function nodesToBlockNoteBlocks(nodes: HtmlNode[]): BlockNoteBlock[] {
  const blocks: BlockNoteBlock[] = [];
  let blockIndex = 0;

  for (const node of nodes) {
    if (node.tag === "ul" || node.tag === "ol") {
      const isOrdered = node.tag === "ol";
      for (const li of node.children) {
        if (li.tag === "li" || li.tag === "_text") {
          const isChecked = li.attrs?.["data-checked"] === "true";
          const block: BlockNoteBlock = {
            id: createBlockId(blockIndex++),
            type: isChecked ? "checkListItem" : (isOrdered ? "numberedListItem" : "bulletListItem"),
            props: {
              backgroundColor: "default",
              textColor: "default",
              textAlignment: "left",
              ...(isChecked ? { checked: true } : {}),
            },
            content: collectInlineContent(li),
            children: li.children.filter((c) => c.tag !== "_text").length > 0
              ? nodesToBlockNoteBlocks(li.children.filter((c) => c.tag !== "_text"))
              : [],
          };
          blocks.push(block);
        }
      }
    } else if (node.tag === "blockquote") {
      blocks.push({
        id: createBlockId(blockIndex++),
        type: "quote",
        props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
        content: collectInlineContent(node),
        children: node.children.filter((c) => c.tag !== "_text").length > 0
          ? nodesToBlockNoteBlocks(node.children.filter((c) => c.tag !== "_text"))
          : [],
      });
    } else if (node.tag === "pre") {
      const codeNode = node.children.find((c) => c.tag === "code");
      const langClass = codeNode?.attrs?.["class"] ?? "";
      const lang = langClass.replace("language-", "") || "plain";
      const codeText = codeNode ? extractTextFromNode(codeNode) : extractTextFromNode(node);
      blocks.push({
        id: createBlockId(blockIndex++),
        type: "codeBlock",
        props: { language: lang, backgroundColor: "default", textColor: "default", textAlignment: "left" },
        content: [{ type: "text", text: codeText, styles: {} }],
        children: [],
      });
    } else if (node.tag === "hr") {
      blocks.push({
        id: createBlockId(blockIndex++),
        type: "divider",
        props: {},
        content: undefined,
        children: [],
      });
    } else {
      const headingMatch = node.tag.match(/^h([1-6])$/);
      if (headingMatch) {
        blocks.push({
          id: createBlockId(blockIndex++),
          type: "heading",
          props: {
            level: parseInt(headingMatch[1]),
            backgroundColor: "default",
            textColor: "default",
            textAlignment: "left",
          },
          content: collectInlineContent(node),
          children: [],
        });
      } else {
        blocks.push({
          id: createBlockId(blockIndex++),
          type: "paragraph",
          props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
          content: collectInlineContent(node),
          children: [],
        });
      }
    }
  }

  return blocks;
}

function collectInlineContent(node: HtmlNode): BlockNoteInlineContent[] {
  const result: BlockNoteInlineContent[] = [];

  for (const child of node.children) {
    if (child.tag === "_text") {
      const text = child.text ?? "";
      if (text) {
        result.push({ type: "text", text, styles: {} });
      }
    } else if (child.tag === "strong" || child.tag === "b") {
      pushStyledChildren(child, { bold: true }, result);
    } else if (child.tag === "em" || child.tag === "i") {
      pushStyledChildren(child, { italic: true }, result);
    } else if (child.tag === "u") {
      pushStyledChildren(child, { underline: true }, result);
    } else if (child.tag === "s" || child.tag === "del" || child.tag === "strike") {
      pushStyledChildren(child, { strikethrough: true }, result);
    } else if (child.tag === "code") {
      pushStyledChildren(child, { code: true }, result);
    } else if (child.tag === "a") {
      const href = child.attrs?.["href"] ?? "";
      const innerContent = collectInlineContent(child);
      result.push({ type: "link", content: innerContent, href });
    } else if (child.tag === "br") {
      result.push({ type: "text", text: "\n", styles: {} });
    } else {
      result.push(...collectInlineContent(child));
    }
  }

  return result;
}

function pushStyledChildren(
  node: HtmlNode,
  extraStyles: Record<string, unknown>,
  result: BlockNoteInlineContent[],
) {
  for (const child of node.children) {
    if (child.tag === "_text") {
      const text = child.text ?? "";
      if (text) {
        result.push({ type: "text", text, styles: { ...extraStyles } });
      }
    } else if (child.tag === "a") {
      const href = child.attrs?.["href"] ?? "";
      const innerContent = collectInlineContent(child).map((ic) => ({
        ...ic,
        styles: { ...(ic.styles ?? {}), ...extraStyles },
      }));
      result.push({ type: "link", content: innerContent, href });
    } else {
      const nestedStyles = styleTagToStyles(child.tag, extraStyles);
      pushStyledChildren(child, nestedStyles, result);
    }
  }
}

function styleTagToStyles(tag: string, base: Record<string, unknown>): Record<string, unknown> {
  switch (tag) {
    case "strong": case "b": return { ...base, bold: true };
    case "em": case "i": return { ...base, italic: true };
    case "u": return { ...base, underline: true };
    case "s": case "del": case "strike": return { ...base, strikethrough: true };
    case "code": return { ...base, code: true };
    default: return base;
  }
}

function extractTextFromNode(node: HtmlNode): string {
  let text = "";
  for (const child of node.children) {
    if (child.tag === "_text") {
      text += child.text ?? "";
    } else {
      text += extractTextFromNode(child);
    }
  }
  return text;
}

export function htmlToBlockNoteJson(html: string): string {
  if (!html.trim()) {
    return JSON.stringify([emptyParagraph(0)], null, 2);
  }

  const nodes = parseHtmlToNodes(html);

  if (nodes.length === 0) {
    return JSON.stringify([emptyParagraph(0)], null, 2);
  }

  const blocks = nodesToBlockNoteBlocks(nodes);
  return JSON.stringify(blocks, null, 2);
}

function emptyParagraph(index: number): BlockNoteBlock {
  return {
    id: createBlockId(index),
    type: "paragraph",
    props: { backgroundColor: "default", textColor: "default", textAlignment: "left" },
    content: [],
    children: [],
  };
}

export function serializeHtmlToBlockNote(html: string): string {
  return htmlToBlockNoteJson(html);
}
