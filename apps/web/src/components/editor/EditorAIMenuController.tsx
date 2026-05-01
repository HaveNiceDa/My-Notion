"use client";

import {
  AIMenu,
  AIMenuController,
} from "@blocknote/xl-ai";
import type { BlockNoteEditor } from "@blocknote/core";
import { getCustomAIMenuItems } from "./customAIMenuItems";

function CustomAIMenu() {
  return (
    <AIMenu
      items={(
        editor: BlockNoteEditor<any, any, any>,
        aiResponseStatus:
          | "user-input"
          | "thinking"
          | "ai-writing"
          | "error"
          | "user-reviewing"
          | "closed",
      ) => getCustomAIMenuItems(editor, aiResponseStatus)}
    />
  );
}

export function EditorAIMenuController() {
  return <AIMenuController aiMenu={CustomAIMenu} />;
}
