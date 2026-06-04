import { describe, expect, it, vi } from "vitest";

import {
  extractMemoryCandidates,
  proposeExtractedMemories,
} from "../memory-extractor";

describe("memory-extractor", () => {
  it("从明确用户信号提取 pending proposal 候选", () => {
    const result = extractMemoryCandidates({
      enabled: true,
      userId: "user-1",
      messages: [
        {
          role: "user",
          content: "以后请记住我偏好中文沟通，回答要直接给结论。",
        },
      ],
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.type).toBe("preference");
    expect(result.proposals[0]?.kind).toBe("instruction");
    expect(result.proposals[0]?.scopeLevel).toBe("user");
  });

  it("将明确的文档/画板规则归类为项目规则", () => {
    const result = extractMemoryCandidates({
      enabled: true,
      userId: "user-1",
      messages: [
        {
          role: "user",
          content: "以后请记住画板缩略图必须保持整宽展示。",
        },
      ],
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.type).toBe("project");
    expect(result.proposals[0]?.category).toBe("project_rule");
  });

  it("默认跳过敏感内容，避免污染 Inbox", () => {
    const result = extractMemoryCandidates({
      enabled: true,
      userId: "user-1",
      messages: [
        {
          role: "user",
          content: "记住我的 API token 是 sk-test-123",
        },
      ],
    });

    expect(result.proposals).toHaveLength(0);
    expect(result.skippedReason).toBe("sensitive");
    expect(result.rejected[0]?.reason).toBe("sensitive");
  });

  it("提取结果只调用 proposeAgentMemory 写入 Inbox", async () => {
    const mutation = vi.fn().mockResolvedValue({ id: "proposal-1" });
    const extraction = extractMemoryCandidates({
      enabled: true,
      userId: "user-1",
      conversationId: "conversation-1",
      messages: [
        {
          role: "user",
          content: "以后请用 shadcn/ui 组件实现前端下拉框。",
        },
      ],
    });

    const result = await proposeExtractedMemories({
      convex: { mutation } as never,
      userId: "user-1",
      conversationId: "conversation-1",
      extraction,
    });

    expect(result.skipped).toBe(false);
    expect(result.proposalIds).toEqual(["proposal-1"]);
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0]?.[1]).toMatchObject({
      source: "auto_extracted",
      evidenceConversationId: "conversation-1",
    });
  });
});
