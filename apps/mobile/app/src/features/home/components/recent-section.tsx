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
    <View style={tw`mb-4`}>
      <View style={tw`px-3 mb-2`}>
        <Text color="$color" style={tw`text-base font-bold`}>
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
              tw`w-40 p-4`,
              {
                borderWidth: 1,
                borderRadius: 24,
                borderColor: theme.borderColor.val,
                backgroundColor: pressed
                  ? theme.backgroundPress.val
                  : theme.backgroundHover.val,
              },
            ]}
          >
            <PageIcon kind={item.iconKind} size={16} />
            <Text color="$color" style={tw`mt-3 text-sm font-semibold`} numberOfLines={2}>
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
