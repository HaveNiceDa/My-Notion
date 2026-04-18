import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import tw from "twrnc";

type Props = {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function CollapsibleSection({ title, expanded, onToggle, children }: Props) {
  return (
    <View style={tw`mb-1`}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) =>
          tw`flex-row items-center justify-between px-3 py-2 rounded-md ${pressed ? "bg-black/5" : ""}`
        }
      >
        <Text style={tw`text-sm font-semibold text-neutral-500`}>{title}</Text>
        <Ionicons
          name="chevron-up"
          size={16}
          color="#737373"
          style={{ transform: [{ rotate: expanded ? "0deg" : "180deg" }] }}
        />
      </Pressable>
      {expanded ? <View style={tw`pl-1`}>{children}</View> : null}
    </View>
  );
}
