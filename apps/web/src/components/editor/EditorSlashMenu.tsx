"use client";

import type { BlockNoteEditor } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { getAISlashMenuItems } from "@blocknote/xl-ai";

interface EditorSlashMenuProps {
  editor: BlockNoteEditor<any, any, any>;
}

export function EditorSlashMenu({ editor }: EditorSlashMenuProps) {
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) =>
        filterSuggestionItems(
          [
            ...getDefaultReactSlashMenuItems(editor),
            ...getAISlashMenuItems(editor),
          ],
          query,
        )
      }
    />
  );
}
