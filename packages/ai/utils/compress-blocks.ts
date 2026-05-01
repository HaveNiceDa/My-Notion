export type BlockWithCursor = {
  id: string;
  type: string;
  content?: unknown;
  children?: unknown[];
  cursor?: boolean;
};

export const DEFAULT_CONTEXT_WINDOW = 5;

export function compressBlocks(
  blocks: BlockWithCursor[],
  contextWindow: number = DEFAULT_CONTEXT_WINDOW,
): { compressed: BlockWithCursor[]; wasCompressed: boolean } {
  if (blocks.length <= contextWindow * 2 + 1) {
    return { compressed: blocks, wasCompressed: false };
  }

  const cursorIndex = blocks.findIndex((b) => b.cursor);
  if (cursorIndex === -1) {
    return { compressed: blocks, wasCompressed: false };
  }

  const start = Math.max(0, cursorIndex - contextWindow);
  const end = Math.min(blocks.length, cursorIndex + contextWindow + 1);
  const compressed = blocks.slice(start, end);

  if (start > 0) {
    compressed.unshift({
      id: `...${start}-blocks-omitted-before`,
      type: "paragraph",
      content: `[${start} block(s) omitted above]`,
    });
  }
  if (end < blocks.length) {
    compressed.push({
      id: `...${blocks.length - end}-blocks-omitted-after`,
      type: "paragraph",
      content: `[${blocks.length - end} block(s) omitted below]`,
    });
  }

  return { compressed, wasCompressed: true };
}
