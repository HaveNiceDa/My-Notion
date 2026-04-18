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
      style={twStyle(
        "absolute bottom-0 left-0 right-0 border-t border-neutral-200/70 px-3 pt-2",
        { backgroundColor: theme.background.val, paddingBottom: Math.max(insets.bottom, 10) },
      )}
    >
      <View style={tw`flex-row items-center gap-2`}>
        <Pressable
          onPress={onPressSearch}
          style={({ pressed }) =>
            tw`w-10 h-10 rounded-full items-center justify-center ${pressed ? "bg-black/5" : ""}`
          }
          accessibilityLabel={t("Navigation.search")}
        >
          <Ionicons name="search" size={24} color="#404040" />
        </Pressable>

        <Pressable
          onPress={onPressAi}
          style={({ pressed }) =>
            twStyle(
              `flex-1 flex-row items-center rounded-full px-4 h-12 gap-2 border border-neutral-200 ${pressed ? "opacity-90" : ""}`,
              { backgroundColor: theme.backgroundHover.val },
            )
          }
          hitSlop={4}
        >
          <Ionicons name="sparkles" size={18} color="#7c3aed" />
          <Text style={tw`text-neutral-500 text-sm flex-1`} numberOfLines={1}>
            {t("AI.aiConversation")}
          </Text>
        </Pressable>

        <Pressable
          onPress={onPressNewPage}
          style={({ pressed }) =>
            tw`w-12 h-12 rounded-2xl bg-neutral-900 items-center justify-center ${pressed ? "opacity-80" : ""}`
          }
          accessibilityLabel={t("Navigation.newPage")}
          hitSlop={4}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
