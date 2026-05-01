import { describe, it, expect } from "vitest";
import {
  compressBlocks,
  DEFAULT_CONTEXT_WINDOW,
  type BlockWithCursor,
} from "../utils/compress-blocks";

function makeBlock(id: string, cursor = false): BlockWithCursor {
  return { id, type: "paragraph", content: `Block ${id}`, cursor };
}

function makeBlocks(count: number, cursorIndex: number): BlockWithCursor[] {
  return Array.from({ length: count }, (_, i) =>
    makeBlock(`block-${i}`, i === cursorIndex),
  );
}

describe("compressBlocks", () => {
  describe("no compression needed", () => {
    it("returns blocks unchanged when count is within context window", () => {
      const blocks = makeBlocks(5, 2);
      const result = compressBlocks(blocks);
      expect(result.wasCompressed).toBe(false);
      expect(result.compressed).toEqual(blocks);
    });

    it("returns blocks unchanged when count equals context window * 2 + 1", () => {
      const blocks = makeBlocks(DEFAULT_CONTEXT_WINDOW * 2 + 1, 5);
      const result = compressBlocks(blocks);
      expect(result.wasCompressed).toBe(false);
      expect(result.compressed).toEqual(blocks);
    });

    it("returns blocks unchanged when no cursor block exists", () => {
      const blocks: BlockWithCursor[] = Array.from({ length: 20 }, (_, i) => ({
        id: `block-${i}`,
        type: "paragraph",
        content: `Block ${i}`,
      }));
      const result = compressBlocks(blocks);
      expect(result.wasCompressed).toBe(false);
      expect(result.compressed).toEqual(blocks);
    });

    it("returns empty array unchanged", () => {
      const result = compressBlocks([]);
      expect(result.wasCompressed).toBe(false);
      expect(result.compressed).toEqual([]);
    });
  });

  describe("compression applied", () => {
    it("compresses blocks around cursor position", () => {
      const blocks = makeBlocks(20, 10);
      const result = compressBlocks(blocks);
      expect(result.wasCompressed).toBe(true);

      const omittedBefore = result.compressed.find(
        (b) => b.id.includes("omitted-before"),
      );
      const omittedAfter = result.compressed.find(
        (b) => b.id.includes("omitted-after"),
      );
      expect(omittedBefore).toBeDefined();
      expect(omittedAfter).toBeDefined();
    });

    it("keeps cursor block in compressed output", () => {
      const blocks = makeBlocks(20, 10);
      const result = compressBlocks(blocks);
      const cursorBlock = result.compressed.find((b) => b.cursor);
      expect(cursorBlock).toBeDefined();
      expect(cursorBlock!.id).toBe("block-10");
    });

    it("keeps blocks within context window around cursor", () => {
      const blocks = makeBlocks(30, 15);
      const result = compressBlocks(blocks, 5);

      const keptIds = result.compressed
        .filter((b) => !b.id.includes("omitted"))
        .map((b) => b.id);

      expect(keptIds).toContain("block-10");
      expect(keptIds).toContain("block-15");
      expect(keptIds).toContain("block-20");
      expect(keptIds).not.toContain("block-9");
      expect(keptIds).not.toContain("block-21");
    });

    it("reports correct number of omitted blocks before cursor", () => {
      const blocks = makeBlocks(20, 10);
      const result = compressBlocks(blocks, 5);
      const omittedBefore = result.compressed.find(
        (b) => b.id.includes("omitted-before"),
      );
      expect(omittedBefore!.content).toBe("[5 block(s) omitted above]");
    });

    it("reports correct number of omitted blocks after cursor", () => {
      const blocks = makeBlocks(20, 10);
      const result = compressBlocks(blocks, 5);
      const omittedAfter = result.compressed.find(
        (b) => b.id.includes("omitted-after"),
      );
      expect(omittedAfter!.content).toBe("[4 block(s) omitted below]");
    });

    it("handles cursor at the beginning", () => {
      const blocks = makeBlocks(20, 0);
      const result = compressBlocks(blocks, 5);
      expect(result.wasCompressed).toBe(true);

      const omittedBefore = result.compressed.find(
        (b) => b.id.includes("omitted-before"),
      );
      expect(omittedBefore).toBeUndefined();

      const omittedAfter = result.compressed.find(
        (b) => b.id.includes("omitted-after"),
      );
      expect(omittedAfter).toBeDefined();
    });

    it("handles cursor at the end", () => {
      const blocks = makeBlocks(20, 19);
      const result = compressBlocks(blocks, 5);
      expect(result.wasCompressed).toBe(true);

      const omittedAfter = result.compressed.find(
        (b) => b.id.includes("omitted-after"),
      );
      expect(omittedAfter).toBeUndefined();

      const omittedBefore = result.compressed.find(
        (b) => b.id.includes("omitted-before"),
      );
      expect(omittedBefore).toBeDefined();
    });

    it("respects custom context window", () => {
      const blocks = makeBlocks(20, 10);
      const result = compressBlocks(blocks, 2);
      expect(result.wasCompressed).toBe(true);

      const keptIds = result.compressed
        .filter((b) => !b.id.includes("omitted"))
        .map((b) => b.id);

      expect(keptIds).toContain("block-8");
      expect(keptIds).toContain("block-10");
      expect(keptIds).toContain("block-12");
      expect(keptIds).not.toContain("block-7");
      expect(keptIds).not.toContain("block-13");
    });
  });

  describe("DEFAULT_CONTEXT_WINDOW", () => {
    it("has value 5", () => {
      expect(DEFAULT_CONTEXT_WINDOW).toBe(5);
    });
  });
});
