import { describe, it, expect, beforeEach } from "vitest";
import {
  computeContentHash,
  getCachedDocumentHash,
  setCachedDocumentHash,
  invalidateDocumentHash,
  clearVectorStoreCache,
} from "../server/vector-store-cache";

describe("vector-store-cache", () => {
  beforeEach(() => {
    clearVectorStoreCache();
  });

  describe("computeContentHash", () => {
    it("returns consistent hash for same input", () => {
      const hash1 = computeContentHash("hello world");
      const hash2 = computeContentHash("hello world");
      expect(hash1).toBe(hash2);
    });

    it("returns different hashes for different inputs", () => {
      const hash1 = computeContentHash("hello");
      const hash2 = computeContentHash("world");
      expect(hash1).not.toBe(hash2);
    });

    it("returns a 16-character hex string", () => {
      const hash = computeContentHash("test content");
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("handles empty string", () => {
      const hash = computeContentHash("");
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe("document hash cache", () => {
    it("returns undefined for uncached document", () => {
      expect(getCachedDocumentHash("user1", "doc1")).toBeUndefined();
    });

    it("stores and retrieves document hash", () => {
      setCachedDocumentHash("user1", "doc1", "abc123");
      expect(getCachedDocumentHash("user1", "doc1")).toBe("abc123");
    });

    it("isolates hashes by user", () => {
      setCachedDocumentHash("user1", "doc1", "hash1");
      setCachedDocumentHash("user2", "doc1", "hash2");
      expect(getCachedDocumentHash("user1", "doc1")).toBe("hash1");
      expect(getCachedDocumentHash("user2", "doc1")).toBe("hash2");
    });

    it("overwrites existing hash", () => {
      setCachedDocumentHash("user1", "doc1", "old");
      setCachedDocumentHash("user1", "doc1", "new");
      expect(getCachedDocumentHash("user1", "doc1")).toBe("new");
    });

    it("invalidates specific document hash", () => {
      setCachedDocumentHash("user1", "doc1", "hash1");
      setCachedDocumentHash("user1", "doc2", "hash2");
      invalidateDocumentHash("user1", "doc1");
      expect(getCachedDocumentHash("user1", "doc1")).toBeUndefined();
      expect(getCachedDocumentHash("user1", "doc2")).toBe("hash2");
    });
  });

  describe("clearVectorStoreCache", () => {
    it("clears all document hashes when called without userId", () => {
      setCachedDocumentHash("user1", "doc1", "hash1");
      setCachedDocumentHash("user2", "doc2", "hash2");
      clearVectorStoreCache();
      expect(getCachedDocumentHash("user1", "doc1")).toBeUndefined();
      expect(getCachedDocumentHash("user2", "doc2")).toBeUndefined();
    });

    it("clears only specific user caches when userId provided", () => {
      setCachedDocumentHash("user1", "doc1", "hash1");
      setCachedDocumentHash("user2", "doc2", "hash2");
      clearVectorStoreCache("user1");
      expect(getCachedDocumentHash("user1", "doc1")).toBeUndefined();
      expect(getCachedDocumentHash("user2", "doc2")).toBe("hash2");
    });
  });
});
