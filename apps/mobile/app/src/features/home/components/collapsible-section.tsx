import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { Text, View, useTheme } from "tamagui";
import tw from "twrnc";

type Props = {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function CollapsibleSection({ title, expanded, onToggle, children }: Props) {
  const theme = useTheme();

  return (
    <View
      style={{
        marginBottom: 12,
        marginHorizontal: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.borderColor.val,
        backgroundColor: theme.backgroundHover.val,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          tw`flex-row items-center justify-between px-4 py-3 rounded-2xl`,
          pressed ? { backgroundColor: theme.backgroundPress.val } : null,
        ]}
      >
        <Text color="$color" style={tw`text-sm font-semibold`}>
          {title}
        </Text>
        <Ionicons
          name="chevron-up"
          size={16}
          color={theme.placeholderColor.val}
          style={{ transform: [{ rotate: expanded ? "0deg" : "180deg" }] }}
        />
      </Pressable>
      {expanded ? <View px="$2" pb="$2">{children}</View> : null}
    </View>
  );
}
