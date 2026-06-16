import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { Text, View, useTheme } from "tamagui";
import tw from "twrnc";

type Props = {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  onPressAction?: () => void;
  children: React.ReactNode;
};

export function CollapsibleSection({
  title,
  expanded,
  onToggle,
  actionLabel,
  actionDisabled,
  onPressAction,
  children,
}: Props) {
  const theme = useTheme();

  return (
    <View
      style={{
        marginBottom: 18,
        marginHorizontal: 12,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          tw`flex-row items-center justify-between px-1 py-2`,
          pressed ? { opacity: 0.75 } : null,
        ]}
      >
        <Text color="$placeholderColor" style={tw`text-sm font-semibold`}>
          {title}
        </Text>
        <View style={tw`flex-row items-center gap-1`}>
          {onPressAction ? (
            <Pressable
              hitSlop={8}
              disabled={actionDisabled}
              accessibilityLabel={actionLabel}
              onPress={(event) => {
                event.stopPropagation();
                onPressAction();
              }}
              style={({ pressed }) => [
                tw`w-7 h-7 rounded-full items-center justify-center`,
                pressed ? { backgroundColor: theme.backgroundPress.val } : null,
                actionDisabled ? { opacity: 0.45 } : null,
              ]}
            >
              <Ionicons name="add" size={18} color={theme.placeholderColor.val} />
            </Pressable>
          ) : null}
          <Ionicons
            name="chevron-up"
            size={15}
            color={theme.placeholderColor.val}
            style={{ transform: [{ rotate: expanded ? "0deg" : "180deg" }] }}
          />
        </View>
      </Pressable>
      {expanded ? <View pb="$1">{children}</View> : null}
    </View>
  );
}
