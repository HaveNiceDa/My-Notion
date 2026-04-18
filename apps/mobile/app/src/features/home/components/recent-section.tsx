import { Pressable } from "react-native";
import { ScrollView, Text, View } from "tamagui";
import tw from "twrnc";

import type { HomeRecentItem } from "../types";
import { PageIcon } from "./page-icon";

type Props = {
  title: string;
  items: HomeRecentItem[];
  onPressCard?: (item: HomeRecentItem) => void;
};

export function RecentSection({ title, items, onPressCard }: Props) {
  return (
    <View style={tw`mb-4`}>
      <Text style={tw`text-sm font-semibold text-neutral-500 px-3 mb-2`}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tw`px-3 gap-3`}
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onPressCard?.(item)}
            style={({ pressed }) =>
              tw`w-36 bg-white rounded-xl p-3 border border-neutral-200/80 shadow-sm ${pressed ? "opacity-80" : ""}`
            }
          >
            <PageIcon kind={item.iconKind} size={16} />
            <Text style={tw`mt-2 text-sm font-semibold text-neutral-900`} numberOfLines={2}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={tw`mt-1 text-xs text-neutral-500`} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
