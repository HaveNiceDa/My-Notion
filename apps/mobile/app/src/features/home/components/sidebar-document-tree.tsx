import { Text, View, useTheme } from "tamagui";
import tw from "twrnc";

import type { Id } from "@convex/_generated/dataModel";

import { WorkspacePageRow } from "./workspace-page-row";
import type { DocumentNode } from "../hooks/use-document-tree";

export type SidebarTreeVariant = "private" | "starred" | "knowledge";

type Props = {
  variant: SidebarTreeVariant;
  nodes: DocumentNode[];
  depth?: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: Id<"documents">) => void;
  onNavigateToDocument: (id: Id<"documents">) => void;
  onCreateChild?: (parentId: Id<"documents">) => void;
  emptyHint?: string;
};

export function SidebarDocumentTree({
  variant: _variant,
  nodes,
  depth = 0,
  expandedIds,
  onToggleExpand,
  onNavigateToDocument,
  onCreateChild,
  emptyHint,
}: Props) {
  const theme = useTheme();

  if (nodes.length === 0 && emptyHint && depth === 0) {
    return (
      <Text style={[tw`text-sm px-3 py-2`, { color: theme.placeholderColor.val }]}>{emptyHint}</Text>
    );
  }

  return (
    <View>
      {nodes.map((node) => (
        <View key={node.document._id}>
          <WorkspacePageRow
            document={node.document}
            depth={depth}
            expandedIds={expandedIds}
            onToggleExpand={onToggleExpand}
            onPressRow={() => onNavigateToDocument(node.document._id)}
            onCreateChild={onCreateChild}
          />
          {expandedIds.has(node.document._id) && node.children.length > 0 ? (
            <SidebarDocumentTree
              variant={_variant}
              nodes={node.children}
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
