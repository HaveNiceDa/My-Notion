import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, useTheme } from "tamagui";
import tw, { style as twStyle } from "twrnc";

import type { Doc, Id } from "@convex/_generated/dataModel";

import { PageIcon } from "./page-icon";
import { DocumentActionSheet } from "./document-action-sheet";

type Props = {
  document: Doc<"documents">;
  depth?: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: Id<"documents">) => void;
  onPressRow: () => void;
  onDeleted?: () => void;
  onCreateChild?: (parentId: Id<"documents">) => void;
};

export function WorkspacePageRow({
  document,
  depth = 0,
  expandedIds,
  onToggleExpand,
  onPressRow,
  onDeleted,
  onCreateChild,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isOpen = expandedIds.has(document._id);
  const paddingLeft = 8 + depth * 14;

  const [actionOpen, setActionOpen] = useState(false);

  return (
    <View
      style={[
        tw`flex-row items-center py-1 pr-1`,
        { backgroundColor: "transparent" },
      ]}
    >
      <View style={twStyle("w-7 items-center justify-center", { marginLeft: paddingLeft })}>
        <Pressable hitSlop={8} onPress={() => onToggleExpand(document._id)} style={tw`p-1`}>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.placeholderColor.val}
            style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
          />
        </Pressable>
      </View>

      <Pressable
        onPress={onPressRow}
        style={({ pressed }) => [
          tw`flex-1 flex-row items-center min-h-10 rounded-lg px-1`,
          pressed ? { backgroundColor: theme.backgroundHover.val } : null,
        ]}
      >
        {document.icon ? (
          <Text style={tw`text-lg mr-2`}>{document.icon}</Text>
        ) : (
          <PageIcon kind="doc" />
        )}
        <Text color="$color" style={tw`flex-1 ml-2 text-[15px]`} numberOfLines={1}>
          {document.title}
        </Text>
        {document.isStarred && (
          <Ionicons name="star" size={14} color={theme.primary.val} style={tw`mr-1`} />
        )}
      </Pressable>

      <Pressable
        hitSlop={8}
        style={tw`p-2`}
        onPress={() => setActionOpen(true)}
        accessibilityLabel={t("Home.more")}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={theme.placeholderColor.val} />
      </Pressable>
      <Pressable hitSlop={8} style={tw`p-2`} onPress={() => onCreateChild?.(document._id)} accessibilityLabel={t("Home.newSubPage")}>
        <Ionicons name="add" size={22} color={theme.placeholderColor.val} />
      </Pressable>

      <DocumentActionSheet
        open={actionOpen}
        onOpenChange={setActionOpen}
        document={document}
        onDeleted={onDeleted}
      />
    </View>
  );
}
