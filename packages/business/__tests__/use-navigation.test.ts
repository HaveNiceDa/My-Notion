import { describe, it, expect, beforeEach } from "vitest";
import { useNavigation } from "../hooks/use-navigation";

describe("useNavigation", () => {
  beforeEach(() => {
    useNavigation.setState({
      isCollapsed: false,
      isAiChatOpen: false,
      isInboxOpen: false,
    });
  });

  it("initializes with correct defaults", () => {
    const state = useNavigation.getState();
    expect(state.isCollapsed).toBe(false);
    expect(state.isAiChatOpen).toBe(false);
    expect(state.isInboxOpen).toBe(false);
  });

  it("sets collapsed state", () => {
    useNavigation.getState().setIsCollapsed(true);
    expect(useNavigation.getState().isCollapsed).toBe(true);
  });

  it("opens and closes AI chat", () => {
    useNavigation.getState().openAiChat();
    expect(useNavigation.getState().isAiChatOpen).toBe(true);
    useNavigation.getState().closeAiChat();
    expect(useNavigation.getState().isAiChatOpen).toBe(false);
  });

  it("opens and closes inbox", () => {
    useNavigation.getState().openInbox();
    expect(useNavigation.getState().isInboxOpen).toBe(true);
    useNavigation.getState().closeInbox();
    expect(useNavigation.getState().isInboxOpen).toBe(false);
  });
});
