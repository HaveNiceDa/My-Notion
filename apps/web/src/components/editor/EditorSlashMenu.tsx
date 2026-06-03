"use client";

import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { getAISlashMenuItems } from "@blocknote/xl-ai";
import { useMutation } from "convex/react";
import { useParams } from "next/navigation";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MyNotionBlockNoteEditor } from "./blocks/schema";
import { createInsertWhiteboardItem } from "./commands/insertWhiteboard";

interface EditorSlashMenuProps {
  editor: MyNotionBlockNoteEditor;
}

export function EditorSlashMenu({ editor }: EditorSlashMenuProps) {
  const params = useParams();
  const documentId = params.documentId as Id<"documents">;
  const locale = (params.locale as string) || "en";
  const createWhiteboard = useMutation(api.whiteboards.create);

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) => {
        const defaultItems = getDefaultReactSlashMenuItems(editor);
        const whiteboardItem = createInsertWhiteboardItem({
          editor,
          documentId,
          locale,
          createWhiteboard,
        });
        const targetGroup = whiteboardItem.group;
        const lastGroupIndex = defaultItems.reduce(
          (lastIndex, item, index) => (item.group === targetGroup ? index : lastIndex),
          -1,
        );
        const itemsWithWhiteboard =
          lastGroupIndex >= 0
            ? [
                ...defaultItems.slice(0, lastGroupIndex + 1),
                whiteboardItem,
                ...defaultItems.slice(lastGroupIndex + 1),
              ]
            : [...defaultItems, whiteboardItem];

        return filterSuggestionItems(
          [
            ...itemsWithWhiteboard,
            ...getAISlashMenuItems(editor),
          ],
          query,
        );
      }}
    />
  );
}
