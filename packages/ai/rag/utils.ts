import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 80,
  separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
});

const STRUCTURED_CHUNK_TARGET_SIZE = 900;
const STRUCTURED_CHUNK_MAX_SIZE = 1200;

type BlockNode = {
  type?: string;
  text?: string;
  props?: Record<string, unknown>;
  content?: BlockNode[];
  children?: BlockNode[];
};

type SectionUnit = {
  text: string;
  blockType: string;
};

type SemanticSection = {
  headingPath: string;
  headings: string[];
  units: SectionUnit[];
  blockTypes: string[];
};

export type RagTextChunk = {
  pageContent: string;
  metadata: {
    chunkStrategy: "heading" | "semantic" | "fixed";
    headingPath: string;
    headings: string[];
    blockTypes: string[];
  };
};

export async function splitDocumentForRag(content: string): Promise<RagTextChunk[]> {
  const structuredChunks = await splitBlockNoteDocument(content);
  if (structuredChunks.length > 0) {
    return structuredChunks;
  }

  const fallbackText = content.trim();
  if (!fallbackText) return [];

  const splits = await textSplitter.splitText(fallbackText);
  return splits
    .map((split) => split.trim())
    .filter(Boolean)
    .map((pageContent) => ({
      pageContent,
      metadata: {
        chunkStrategy: "fixed" as const,
        headingPath: "",
        headings: [],
        blockTypes: ["text"],
      },
    }));
}

async function splitBlockNoteDocument(content: string): Promise<RagTextChunk[]> {
  let blocks: BlockNode[];
  try {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    blocks = parsed as BlockNode[];
  } catch {
    return [];
  }

  const sections = collectSemanticSections(blocks);
  const chunks: RagTextChunk[] = [];

  for (const section of sections) {
    chunks.push(...await splitSection(section));
  }

  return chunks.filter((chunk) => chunk.pageContent.trim().length > 0);
}

function collectSemanticSections(blocks: BlockNode[]): SemanticSection[] {
  const sections: SemanticSection[] = [];
  const headingStack: Array<{ level: number; text: string }> = [];
  let currentSection = createSection([]);

  const flush = () => {
    if (currentSection.units.length > 0) {
      sections.push(currentSection);
    }
  };

  const visitBlock = (block: BlockNode) => {
    if (block.type === "heading") {
      flush();
      const heading = inlineText(block.content).trim();
      const level = typeof block.props?.level === "number" ? block.props.level : 1;

      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      if (heading) headingStack.push({ level, text: heading });
      currentSection = createSection(headingStack.map((item) => item.text));
      if (heading) {
        currentSection.units.push({
          text: `${"#".repeat(Math.min(Math.max(level, 1), 6))} ${heading}`,
          blockType: "heading",
        });
        currentSection.blockTypes.push("heading");
      }
    } else {
      const unit = blockToSectionUnit(block);
      if (unit) {
        currentSection.units.push(unit);
        currentSection.blockTypes.push(unit.blockType);
      }
    }

    if (Array.isArray(block.children)) {
      for (const child of block.children) visitBlock(child);
    }
  };

  for (const block of blocks) visitBlock(block);
  flush();

  return sections;
}

function createSection(headings: string[]): SemanticSection {
  return {
    headingPath: headings.join(" > "),
    headings,
    units: [],
    blockTypes: [],
  };
}

function blockToSectionUnit(block: BlockNode): SectionUnit | null {
  const blockType = block.type ?? "paragraph";

  if (blockType === "whiteboard") {
    const title = stringProp(block.props?.title, "Untitled whiteboard");
    const whiteboardId = stringProp(block.props?.whiteboardId, "unknown");
    return {
      text: `![My-Notion Whiteboard: ${title}](mynotion-whiteboard://${whiteboardId})`,
      blockType,
    };
  }

  if (blockType === "image") {
    const url = stringProp(block.props?.url, "");
    const caption = stringProp(block.props?.caption, "");
    if (!url && !caption) return null;
    return {
      text: caption ? `![${caption}](${url})` : `![](${url})`,
      blockType,
    };
  }

  const text = inlineText(block.content).trim();
  if (!text) return null;

  if (blockType === "bulletListItem") return { text: `- ${text}`, blockType };
  if (blockType === "numberedListItem") return { text: `1. ${text}`, blockType };
  if (blockType === "checkListItem") return { text: `- [ ] ${text}`, blockType };
  if (blockType === "codeBlock") {
    const language = stringProp(block.props?.language, "");
    return { text: `\`\`\`${language}\n${text}\n\`\`\``, blockType };
  }

  return { text, blockType };
}

async function splitSection(section: SemanticSection): Promise<RagTextChunk[]> {
  const chunks: RagTextChunk[] = [];
  let currentUnits: SectionUnit[] = [];
  let currentLength = 0;

  const flush = () => {
    if (currentUnits.length === 0) return;
    chunks.push(createChunk(section, currentUnits));
    currentUnits = [];
    currentLength = 0;
  };

  for (const unit of section.units) {
    if (unit.text.length > STRUCTURED_CHUNK_MAX_SIZE) {
      flush();
      const splits = await textSplitter.splitText(unit.text);
      for (const split of splits) {
        const text = split.trim();
        if (!text) continue;
        chunks.push(createChunk(section, [{ ...unit, text }], "fixed"));
      }
      continue;
    }

    const nextLength = currentLength + (currentUnits.length > 0 ? 2 : 0) + unit.text.length;
    if (currentUnits.length > 0 && nextLength > STRUCTURED_CHUNK_TARGET_SIZE) {
      flush();
    }

    currentUnits.push(unit);
    currentLength += (currentUnits.length > 1 ? 2 : 0) + unit.text.length;
  }

  flush();
  return chunks;
}

function createChunk(
  section: SemanticSection,
  units: SectionUnit[],
  strategy?: RagTextChunk["metadata"]["chunkStrategy"],
): RagTextChunk {
  const blockTypes = Array.from(new Set(units.map((unit) => unit.blockType)));
  const hasHeading = blockTypes.includes("heading");

  return {
    pageContent: units.map((unit) => unit.text).join("\n\n"),
    metadata: {
      chunkStrategy: strategy ?? (hasHeading ? "heading" : "semantic"),
      headingPath: section.headingPath,
      headings: section.headings.slice(0, 8),
      blockTypes,
    },
  };
}

function inlineText(node: unknown): string {
  if (Array.isArray(node)) {
    return node.map(inlineText).join("");
  }

  if (!node || typeof node !== "object") {
    return "";
  }

  const block = node as BlockNode;
  const text = typeof block.text === "string" ? block.text : "";
  return `${text}${inlineText(block.content)}${inlineText(block.children)}`;
}

function stringProp(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export const buildEnhancedQuery = (
  query: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
): string => {
  if (conversationHistory.length === 0) {
    return query;
  }

  const recentHistory = conversationHistory.slice(-3);

  const historySummary = recentHistory
    .map(
      (msg) =>
        `${msg.role === "user" ? "用户" : "助手"}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`,
    )
    .join("\n");

  return `基于之前的对话:\n${historySummary}\n\n当前问题: ${query}`;
};
