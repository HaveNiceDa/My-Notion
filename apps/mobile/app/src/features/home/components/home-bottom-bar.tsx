import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View, useTheme } from "tamagui";
import tw, { style as twStyle } from "twrnc";

type Props = {
  onPressSearch?: () => void;
  onPressAi?: () => void;
  onPressNewPage?: () => void;
};

export function HomeBottomBar({ onPressSearch, onPressAi, onPressNewPage }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={twStyle("absolute bottom-0 left-0 right-0 px-3", {
        paddingBottom: Math.max(insets.bottom, 10),
      })}
    >
      <View
        style={twStyle("flex-row items-center gap-2 px-2 py-2", {
          backgroundColor: theme.background.val,
          borderColor: theme.borderColor.val,
          borderWidth: 1,
          borderRadius: 28,
        })}
      >
        <Pressable
          onPress={onPressSearch}
          style={({ pressed }) => [
            tw`w-10 h-10 rounded-full items-center justify-center`,
            pressed ? { backgroundColor: theme.backgroundPress.val } : null,
          ]}
          accessibilityLabel={t("Navigation.search")}
        >
          <Ionicons name="search" size={22} color={theme.color.val} />
        </Pressable>

        <Pressable
          onPress={onPressAi}
          style={({ pressed }) =>
            twStyle("flex-1 flex-row items-center rounded-full px-4 h-12 gap-2", {
              backgroundColor: pressed ? theme.backgroundPress.val : theme.backgroundHover.val,
              borderColor: theme.borderColor.val,
              borderWidth: 1,
            })
          }
          hitSlop={4}
        >
          <Ionicons name="sparkles" size={18} color={theme.primary.val} />
          <Text color="$placeholderColor" style={tw`text-sm flex-1`} numberOfLines={1}>
            {t("AI.aiConversation")}
          </Text>
        </Pressable>

        <Pressable
          onPress={onPressNewPage}
          style={({ pressed }) => [
            tw`w-12 h-12 rounded-2xl items-center justify-center`,
            { backgroundColor: theme.primary.val },
            pressed ? { opacity: 0.85 } : null,
          ]}
          accessibilityLabel={t("Navigation.newPage")}
          hitSlop={4}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
