import { describe, expect, it } from "vitest";
import { clampScore, deriveMemoryDefaults } from "../agentMemories/model";

describe("agent memory model defaults", () => {
  it("maps legacy preference memories to instruction memory defaults", () => {
    expect(deriveMemoryDefaults("preference", "user-1")).toMatchObject({
      kind: "instruction",
      category: "user_preference",
      scopeLevel: "user",
      scopeKey: "user-1",
      importance: 0.5,
      stability: "evolving",
      privacy: "normal",
      usageCount: 0,
      embeddingStatus: "pending",
      embeddingRetryCount: 0,
    });
  });

  it("maps legacy project memories to semantic memory defaults", () => {
    expect(deriveMemoryDefaults("project", "user-1")).toMatchObject({
      kind: "semantic",
      category: "project_fact",
      stability: "evolving",
    });
  });

  it("maps legacy episodic memories to temporary episodic defaults", () => {
    expect(deriveMemoryDefaults("episodic", "user-1")).toMatchObject({
      kind: "episodic",
      category: "session_note",
      stability: "temporary",
    });
  });

  it("clamps score-like fields to the 0-1 range", () => {
    expect(clampScore(undefined, 0.5)).toBe(0.5);
    expect(clampScore(Number.NaN, 0.5)).toBe(0.5);
    expect(clampScore(-1, 0.5)).toBe(0);
    expect(clampScore(2, 0.5)).toBe(1);
    expect(clampScore(0.7, 0.5)).toBe(0.7);
  });
});
