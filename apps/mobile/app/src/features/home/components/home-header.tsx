import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Popover, Text, View, YStack, useTheme } from "tamagui";
import tw from "twrnc";

type Props = {
  workspaceTitle: string;
  openMenuLabel: string;
  changeLanguageLabel: string;
  changeThemeLabel: string;
  settingsLabel: string;
  inboxLabel: string;
  workspaceMenuLabel: string;
  workspaceSummary: string;
  onPressWorkspace?: () => void;
  onPressInbox?: () => void;
  onOpenLanguagePicker?: () => void;
  onOpenThemePicker?: () => void;
};

export function HomeHeader({
  workspaceTitle,
  openMenuLabel,
  changeLanguageLabel,
  changeThemeLabel,
  settingsLabel,
  inboxLabel,
  workspaceMenuLabel,
  workspaceSummary,
  onPressWorkspace,
  onPressInbox,
  onOpenLanguagePicker,
  onOpenThemePicker,
}: Props) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const handleLanguagePress = () => {
    setPopoverOpen(false);
    onOpenLanguagePicker?.();
  };

  const handleThemePress = () => {
    setPopoverOpen(false);
    onOpenThemePicker?.();
  };

  return (
    <View
      background="$background"
      pt={insets.top}
    >
      <View
        px="$3"
        pb="$3"
        pt="$2"
        gap="$3"
        style={{
          marginHorizontal: 12,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: theme.borderColor.val,
          borderRadius: 28,
          backgroundColor: theme.backgroundHover.val,
        }}
      >
        <View style={tw`flex-row items-center justify-between`}>
        <Pressable
          onPress={onPressWorkspace}
          accessibilityLabel={workspaceMenuLabel}
          style={({ pressed }) =>
            tw`flex-row items-center max-w-[70%] ${pressed ? "opacity-70" : ""}`
          }
        >
          <Text
            color="$color"
            style={tw`text-lg font-semibold`}
            numberOfLines={1}
          >
            {workspaceTitle}
          </Text>
          <Ionicons
            name="chevron-down"
            size={18}
            color={theme.color.val}
            style={tw`ml-1`}
          />
        </Pressable>

        <View style={tw`flex-row items-center gap-1`}>
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
              size={22}
              color={theme.color.val}
            />
          </Pressable>

          <Popover
            placement="bottom-end"
            allowFlip
            open={popoverOpen}
            onOpenChange={setPopoverOpen}
          >
            <Popover.Trigger asChild>
              <Pressable
                hitSlop={10}
                style={({ pressed }) => [
                  tw`p-2 rounded-full`,
                  pressed ? { backgroundColor: theme.backgroundPress.val } : null,
                ]}
                accessibilityLabel={openMenuLabel}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={22}
                  color={theme.color.val}
                />
              </Pressable>
            </Popover.Trigger>

            <Popover.Content
              p="$2"
              borderWidth={1}
              borderColor="$borderColor"
              bg="$backgroundHover"
              style={{ borderRadius: 20 }}
            >
              <YStack gap="$2" width={150}>
                <Text fontSize={12} color="$color10" px="$2">
                  {settingsLabel}
                </Text>
                <Button onPress={handleLanguagePress}>
                  <Text style={tw`w-full text-left`}>
                    {changeLanguageLabel}
                  </Text>
                </Button>
                <Button onPress={handleThemePress}>
                  <Text style={tw`w-full text-left`}>{changeThemeLabel}</Text>
                </Button>
              </YStack>
            </Popover.Content>
          </Popover>
        </View>
        </View>

        <View
          px="$3"
          py="$3"
          style={{
            borderRadius: 22,
            backgroundColor: theme.background.val,
            borderWidth: 1,
            borderColor: theme.borderColor.val,
          }}
        >
          <Text color="$color" style={tw`text-xl font-bold`}>
            {workspaceTitle}
          </Text>
          <Text color="$placeholderColor" style={tw`text-sm mt-1`}>
            {workspaceSummary}
          </Text>
        </View>
      </View>
    </View>
  );
}
