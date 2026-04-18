import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { Text, View } from "tamagui";
import tw, { style as twStyle } from "twrnc";

import type { Doc, Id } from "@convex/_generated/dataModel";

import { PageIcon } from "./page-icon";

type Props = {
  document: Doc<"documents">;
  depth?: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: Id<"documents">) => void;
  onPressRow: () => void;
};

export function WorkspacePageRow({
  document,
  depth = 0,
  expandedIds,
  onToggleExpand,
  onPressRow,
}: Props) {
  const isOpen = expandedIds.has(document._id);
  const paddingLeft = 8 + depth * 14;

  return (
    <View style={tw`flex-row items-center py-2 pr-2 rounded-md`}>
      <View style={twStyle("w-7 items-center justify-center", { marginLeft: paddingLeft })}>
        <Pressable hitSlop={8} onPress={() => onToggleExpand(document._id)} style={tw`p-1`}>
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#525252"
            style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
          />
        </Pressable>
      </View>

      <Pressable
        onPress={onPressRow}
        style={({ pressed }) =>
          tw`flex-1 flex-row items-center min-h-10 ${pressed ? "opacity-70" : ""}`
        }
      >
        <PageIcon kind="doc" />
        <Text style={tw`flex-1 ml-2 text-base text-neutral-900`} numberOfLines={1}>
          {document.title}
        </Text>
      </Pressable>

      <Pressable hitSlop={8} style={tw`p-2`} onPress={() => {}} accessibilityLabel="更多">
        <Ionicons name="ellipsis-horizontal" size={18} color="#737373" />
      </Pressable>
      <Pressable hitSlop={8} style={tw`p-2`} onPress={() => {}} accessibilityLabel="新建子页面">
        <Ionicons name="add" size={22} color="#737373" />
      </Pressable>
    </View>
  );
}
