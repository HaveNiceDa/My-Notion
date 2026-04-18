import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import tw from "twrnc";

import type { HomePageItem } from "../types";
import { PageIcon } from "./page-icon";

type Props = {
  item: HomePageItem;
  depth?: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onPressRow?: (item: HomePageItem) => void;
};

export function WorkspacePageRow({
  item,
  depth = 0,
  expandedIds,
  onToggleExpand,
  onPressRow,
}: Props) {
  const hasChildren = !!item.children && item.children.length > 0;
  const isOpen = expandedIds.has(item.id);
  const paddingLeft = 8 + depth * 14;

  return (
    <View>
      <Pressable
        onPress={() => onPressRow?.(item)}
        style={({ pressed }) =>
          tw`flex-row items-center py-2 pr-2 rounded-md ${pressed ? "bg-black/5" : ""}`
        }
      >
        <View style={[tw`w-7 items-center justify-center`, { marginLeft: paddingLeft }]}>
          {hasChildren ? (
            <Pressable
              hitSlop={8}
              onPress={() => onToggleExpand(item.id)}
              style={tw`p-1`}
            >
              <Ionicons
                name="chevron-forward"
                size={16}
                color="#525252"
                style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
              />
            </Pressable>
          ) : (
            <View style={tw`w-4 h-4`} />
          )}
        </View>

        <PageIcon kind={item.iconKind} />
        <Text style={tw`flex-1 ml-2 text-base text-neutral-900`} numberOfLines={1}>
          {item.title}
        </Text>

        <Pressable hitSlop={8} style={tw`p-2`} onPress={() => {}} accessibilityLabel="更多">
          <Ionicons name="ellipsis-horizontal" size={18} color="#737373" />
        </Pressable>
        <Pressable hitSlop={8} style={tw`p-2`} onPress={() => {}} accessibilityLabel="新建子页面">
          <Ionicons name="add" size={22} color="#737373" />
        </Pressable>
      </Pressable>

      {hasChildren && isOpen
        ? item.children!.map((child) => (
            <WorkspacePageRow
              key={child.id}
              item={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onPressRow={onPressRow}
            />
          ))
        : null}
    </View>
  );
}
