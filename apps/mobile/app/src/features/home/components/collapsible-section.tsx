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
        <Ionicons
          name="chevron-up"
          size={15}
          color={theme.placeholderColor.val}
          style={{ transform: [{ rotate: expanded ? "0deg" : "180deg" }] }}
        />
      </Pressable>
      {expanded ? <View pb="$1">{children}</View> : null}
    </View>
  );
}
