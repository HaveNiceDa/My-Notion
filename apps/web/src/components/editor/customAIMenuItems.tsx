"use client";

import type { BlockNoteEditor } from "@blocknote/core";
import type { AIMenuSuggestionItem } from "@blocknote/xl-ai";
import { getDefaultAIMenuItems } from "@blocknote/xl-ai";
import {
  getCustomItemsForContext,
  type CustomAIMenuItemDef,
} from "@notion/ai/utils";

function toItem(
  itemDef: CustomAIMenuItemDef & {
    resolvedTitle: string;
    resolvedSubtext: string;
  },
): AIMenuSuggestionItem {
  return {
    key: itemDef.key,
    title: itemDef.resolvedTitle,
    subtext: itemDef.resolvedSubtext,
    onItemClick: (setPrompt: (userPrompt: string) => void) => {
      setPrompt(itemDef.prompt);
    },
    icon: <span>{itemDef.icon}</span>,
  } as AIMenuSuggestionItem;
}

export function getCustomAIMenuItems(
  editor: BlockNoteEditor<any, any, any>,
  aiResponseStatus:
    | "user-input"
    | "thinking"
    | "ai-writing"
    | "error"
    | "user-reviewing"
    | "closed",
  locale: string = "en",
): AIMenuSuggestionItem[] {
  if (aiResponseStatus !== "user-input") {
    return getDefaultAIMenuItems(editor, aiResponseStatus);
  }

  const hasSelection = !!editor.getSelection();
  const customItems = getCustomItemsForContext(hasSelection, locale);

  return [
    ...getDefaultAIMenuItems(editor, aiResponseStatus),
    ...customItems.map(toItem),
  ];
}
