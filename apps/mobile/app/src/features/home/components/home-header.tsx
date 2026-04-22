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
  trashLabel: string;
  workspaceMenuLabel: string;
  onPressWorkspace?: () => void;
  onPressInbox?: () => void;
  onPressTrash?: () => void;
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
  trashLabel,
  workspaceMenuLabel,
  onPressWorkspace,
  onPressInbox,
  onPressTrash,
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

  const handleTrashPress = () => {
    setPopoverOpen(false);
    onPressTrash?.();
  };

  return (
    <View background="$background" pt={insets.top}>
      <View px="$4" pb="$2" pt="$2" style={{ marginBottom: 6 }}>
        <View style={tw`flex-row items-center justify-between`}>
          <Pressable
            onPress={onPressWorkspace}
            accessibilityLabel={workspaceMenuLabel}
            style={({ pressed }) =>
              tw`flex-row items-center max-w-[72%] ${pressed ? "opacity-70" : ""}`
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
                size={21}
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
                    pressed
                      ? { backgroundColor: theme.backgroundPress.val }
                      : null,
                  ]}
                  accessibilityLabel={openMenuLabel}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={21}
                    color={theme.color.val}
                  />
                </Pressable>
              </Popover.Trigger>

              <Popover.Content
                p="$2"
                borderWidth={1}
                borderColor="$borderColor"
                bg="$background"
                style={{ borderRadius: 18 }}
              >
                <YStack gap="$2" width={150}>
                  <Text fontSize={12} color="$color10" px="$2">
                    {settingsLabel}
                  </Text>
                  <Button onPress={handleLanguagePress} chromeless>
                    <Text style={tw`w-full text-left`}>
                      {changeLanguageLabel}
                    </Text>
                  </Button>
                  <Button onPress={handleThemePress} chromeless>
                    <Text style={tw`w-full text-left`}>{changeThemeLabel}</Text>
                  </Button>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: theme.borderColor.val,
                      marginVertical: 2,
                    }}
                  />
                  <Button onPress={handleTrashPress} chromeless>
                    <Text style={tw`w-full text-left`}>{trashLabel}</Text>
                  </Button>
                </YStack>
              </Popover.Content>
            </Popover>
          </View>
        </View>
      </View>
    </View>
  );
}
