"use client";

import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { getAISlashMenuItems } from "@blocknote/xl-ai";

import type { MyNotionBlockNoteEditor } from "./blocks/schema";

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
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) => {
        const defaultItems = getDefaultReactSlashMenuItems(editor);

        return filterAndRankSuggestionItems(
          [
            ...defaultItems,
            ...getAISlashMenuItems(editor),
          ],
          query,
        );
      }}
    />
  );
}
