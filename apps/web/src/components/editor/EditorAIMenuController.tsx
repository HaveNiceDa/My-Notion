"use client";

import {
  AIMenu,
  AIMenuController,
} from "@blocknote/xl-ai";
import type { BlockNoteEditor } from "@blocknote/core";
import { getCustomAIMenuItems } from "./customAIMenuItems";

interface EditorAIMenuControllerProps {
  editor: BlockNoteEditor<any, any, any>;
  locale: string;
}

function createCustomAIMenu(locale: string) {
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
        ) => getCustomAIMenuItems(editor, aiResponseStatus, locale)}
      />
    );
  }
  return CustomAIMenu;
}

export function EditorAIMenuController({
  editor,
  locale,
}: EditorAIMenuControllerProps) {
  const CustomAIMenu = createCustomAIMenu(locale);
  return <AIMenuController aiMenu={CustomAIMenu} />;
}
