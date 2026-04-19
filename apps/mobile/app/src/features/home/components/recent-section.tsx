import { Pressable } from "react-native";
import { ScrollView, Text, View, useTheme } from "tamagui";
import tw from "twrnc";

import type { HomeRecentItem } from "../types";
import { PageIcon } from "./page-icon";

type Props = {
  title: string;
  items: HomeRecentItem[];
  onPressCard?: (item: HomeRecentItem) => void;
};

export function RecentSection({ title, items, onPressCard }: Props) {
  const theme = useTheme();

  return (
    <View style={tw`mb-5`}>
      <View style={tw`px-3 mb-2`}>
        <Text color="$placeholderColor" style={tw`text-sm font-semibold`}>
          {title}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tw`px-3 gap-3`}
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onPressCard?.(item)}
            style={({ pressed }) => [
              tw`w-34 p-3`,
              {
                borderWidth: 1,
                borderRadius: 16,
                borderColor: theme.borderColor.val,
                backgroundColor: theme.background.val,
              },
              pressed ? { opacity: 0.78 } : null,
            ]}
          >
            <PageIcon kind={item.iconKind} size={16} />
            <Text color="$color" style={tw`mt-3 text-sm font-medium`} numberOfLines={2}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text color="$placeholderColor" style={tw`mt-1 text-xs`} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
