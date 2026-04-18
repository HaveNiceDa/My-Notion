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
      bg="$background"
      borderBottomWidth={1}
      borderBottomColor="$borderColor"
      pt={insets.top}
    >
      <View style={tw`flex-row items-center justify-between px-3 pb-3 pt-1`}>
        <Pressable
          onPress={onPressWorkspace}
          accessibilityLabel={workspaceMenuLabel}
          style={({ pressed }) =>
            tw`flex-row items-center max-w-[70%] ${pressed ? "opacity-70" : ""}`
          }
        >
          <Text
            style={tw`text-lg font-semibold text-neutral-900`}
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
            style={tw`p-2 rounded-full`}
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
                style={tw`p-2 rounded-full`}
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
              bg="$background"
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
    </View>
  );
}
