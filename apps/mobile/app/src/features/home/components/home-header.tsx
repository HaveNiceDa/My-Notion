import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, View, useTheme } from "tamagui";
import tw from "twrnc";

import { useSettings } from "@notion/business/hooks";

type Props = {
  workspaceTitle: string;
  settingsLabel: string;
  inboxLabel: string;
  trashLabel: string;
  onPressInbox?: () => void;
  onPressTrash?: () => void;
};

export function HomeHeader({
  workspaceTitle,
  settingsLabel,
  inboxLabel,
  trashLabel,
  onPressInbox,
  onPressTrash,
}: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const settings = useSettings();

  return (
    <View background="$background" pt={insets.top}>
      <View px="$4" pb="$2" pt="$2" style={{ marginBottom: 6 }}>
        <View style={tw`flex-row items-center justify-between`}>
          <Pressable
            onPress={settings.onOpen}
            accessibilityLabel={workspaceTitle}
            style={({ pressed }) =>
              tw`flex-row items-center max-w-[60%] ${pressed ? "opacity-70" : ""}`
            }
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={theme.placeholderColor.val}
            />
            <Text
              color="$color"
              style={tw`text-base font-semibold ml-2`}
              numberOfLines={1}
            >
              {workspaceTitle}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={theme.placeholderColor.val}
              style={tw`ml-1`}
            />
          </Pressable>

          <View style={tw`flex-row items-center`}>
            <Pressable
              hitSlop={10}
              onPress={onPressTrash}
              style={({ pressed }) => [
                tw`p-2 rounded-full`,
                pressed ? { backgroundColor: theme.backgroundPress.val } : null,
              ]}
              accessibilityLabel={trashLabel}
            >
              <Ionicons
                name="trash-outline"
                size={21}
                color={theme.color.val}
              />
            </Pressable>

            <Pressable
              hitSlop={10}
              onPress={onPressInbox}
              style={({ pressed }) => [
                tw`p-2 rounded-full`,
                pressed ? { backgroundColor: theme.backgroundPress.val } : null,
              ]}
              accessibilityLabel={inboxLabel}
            >
              <Ionicons
                name="file-tray-outline"
                size={21}
                color={theme.color.val}
              />
            </Pressable>

            <Pressable
              hitSlop={10}
              onPress={settings.onOpen}
              style={({ pressed }) => [
                tw`p-2 rounded-full`,
                pressed ? { backgroundColor: theme.backgroundPress.val } : null,
              ]}
              accessibilityLabel={settingsLabel}
            >
              <Ionicons
                name="settings-outline"
                size={21}
                color={theme.color.val}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
