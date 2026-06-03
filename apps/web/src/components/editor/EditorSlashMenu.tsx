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

function normalizeQuery(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function rankSuggestionItem(
  item: { title: string; aliases?: readonly string[] },
  query: string,
) {
  if (!query) return 0;
  const normalizedQuery = normalizeQuery(query);
  const candidates = [item.title, ...(item.aliases ?? [])].map(normalizeQuery);

  if (candidates.some((candidate) => candidate === normalizedQuery)) return 0;
  if (candidates.some((candidate) => candidate.startsWith(normalizedQuery))) return 1;
  if (candidates.some((candidate) => candidate.includes(normalizedQuery))) return 2;
  return 3;
}

function filterAndRankSuggestionItems<T extends { title: string; aliases?: readonly string[] }>(
  items: T[],
  query: string,
) {
  return filterSuggestionItems(items, query).sort(
    (left, right) => rankSuggestionItem(left, query) - rankSuggestionItem(right, query),
  );
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
        const firstGroupIndex = defaultItems.findIndex(
          (item) => item.group === targetGroup,
        );
        const itemsWithWhiteboard =
          firstGroupIndex >= 0
            ? [
                ...defaultItems.slice(0, firstGroupIndex),
                whiteboardItem,
                ...defaultItems.slice(firstGroupIndex),
              ]
            : [...defaultItems, whiteboardItem];

        return filterAndRankSuggestionItems(
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
