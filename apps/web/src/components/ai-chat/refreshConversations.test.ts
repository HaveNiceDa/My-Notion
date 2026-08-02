import { describe, expect, it, vi } from "vitest";
import { refreshConversationsWithLoading } from "./refreshConversations";
import type { Conversation } from "./types";

describe("refreshConversationsWithLoading", () => {
  it("sets loading false after loadConversations rejects", async () => {
    const loadingStates: boolean[] = [];
    const setIsLoadingConversations = (loading: boolean) => {
      loadingStates.push(loading);
    };
    const setConversations = vi.fn();
    const onError = vi.fn();

    await refreshConversationsWithLoading({
      loadConversations: async () => {
        throw new Error("convex unavailable");
      },
      setConversations,
      setIsLoadingConversations,
      onError,
    });

    expect(loadingStates).toEqual([true, false]);
    expect(setConversations).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("loads conversations and clears loading on success", async () => {
    const loadingStates: boolean[] = [];
    const conversations: Conversation[] = [
      {
        _id: "conv-1" as Conversation["_id"],
        title: "Test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    const setConversations = vi.fn();

    await refreshConversationsWithLoading({
      loadConversations: async () => conversations,
      setConversations,
      setIsLoadingConversations: (loading) => loadingStates.push(loading),
    });

    expect(loadingStates).toEqual([true, false]);
    expect(setConversations).toHaveBeenCalledWith(conversations);
  });
});
