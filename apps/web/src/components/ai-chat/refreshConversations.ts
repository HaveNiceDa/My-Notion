import type { Conversation } from "./types";

/**
 * Load conversations while guaranteeing the loading flag clears on success or failure.
 * Used by useAIChatState.refreshConversations.
 */
export async function refreshConversationsWithLoading(options: {
  loadConversations: () => Promise<Conversation[]>;
  setConversations: (conversations: Conversation[]) => void;
  setIsLoadingConversations: (loading: boolean) => void;
  onError?: (error: unknown) => void;
}): Promise<void> {
  const {
    loadConversations,
    setConversations,
    setIsLoadingConversations,
    onError = (error) => console.error("Error loading conversations:", error),
  } = options;

  setIsLoadingConversations(true);
  try {
    const loaded = await loadConversations();
    setConversations(loaded);
  } catch (error) {
    onError(error);
  } finally {
    setIsLoadingConversations(false);
  }
}
