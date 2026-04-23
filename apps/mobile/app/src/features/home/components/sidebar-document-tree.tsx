import { useQuery } from "convex/react";
import { Spinner, Text, View, useTheme } from "tamagui";
import tw from "twrnc";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

import { WorkspacePageRow } from "./workspace-page-row";

export type SidebarTreeVariant = "private" | "starred" | "knowledge";

type Props = {
  variant: SidebarTreeVariant;
  parentDocument?: Id<"documents">;
  rootDocuments?: Doc<"documents">[];
  depth?: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: Id<"documents">) => void;
  onNavigateToDocument: (id: Id<"documents">) => void;
  onCreateChild?: (parentId: Id<"documents">) => void;
  emptyHint?: string;
};

export function SidebarDocumentTree({
  variant,
  parentDocument,
  rootDocuments,
  depth = 0,
  expandedIds,
  onToggleExpand,
  onNavigateToDocument,
  onCreateChild,
  emptyHint,
}: Props) {
  const theme = useTheme();
  const atRoot = parentDocument === undefined;

  const sidebarList = useQuery(
    api.documents.getSidebar,
    parentDocument !== undefined || variant === "private"
      ? { parentDocument: parentDocument || undefined }
      : "skip",
  );

  const starredRoot = useQuery(
    api.documents.getStarred,
    variant === "starred" && atRoot ? {} : "skip",
  );

  const kbRoot = useQuery(
    api.documents.getKnowledgeBaseDocuments,
    variant === "knowledge" && atRoot ? {} : "skip",
  );

  const documents: Doc<"documents">[] | undefined = atRoot
    ? variant === "starred"
      ? starredRoot
      : variant === "knowledge"
        ? kbRoot
        : rootDocuments || []
    : sidebarList;

  if (documents === undefined) {
    return (
      <View style={tw`py-2 pl-3`}>
        <Spinner />
      </View>
    );
  }

  if (documents.length === 0 && emptyHint && atRoot) {
    return (
      <Text style={[tw`text-sm px-3 py-2`, { color: theme.placeholderColor.val }]}>{emptyHint}</Text>
    );
  }

  return (
    <View>
      {documents.map((doc) => (
        <View key={doc._id}>
          <WorkspacePageRow
            document={doc}
            depth={depth}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            onPressRow={() => onNavigateToDocument(doc._id)}
            onCreateChild={onCreateChild}
          />
          {expandedIds.has(doc._id) ? (
            <SidebarDocumentTree
              variant={variant}
              parentDocument={doc._id}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onNavigateToDocument={onNavigateToDocument}
              onCreateChild={onCreateChild}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
