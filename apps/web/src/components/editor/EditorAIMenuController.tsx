"use client";

import { AIMenuController } from "@blocknote/xl-ai";
import type { BlockNoteEditor } from "@blocknote/core";

interface EditorAIMenuControllerProps {
  editor: BlockNoteEditor<any, any, any>;
  locale: string;
}

export function EditorAIMenuController({
  editor: _editor,
  locale: _locale,
}: EditorAIMenuControllerProps) {
  return <AIMenuController />;
}
