import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import tw from "twrnc";

type Props = {
  workspaceTitle: string;
  onPressInbox?: () => void;
  onPressMenu?: () => void;
};

export function HomeHeader({ workspaceTitle, onPressInbox, onPressMenu }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tw`bg-[#f7f7f5] border-b border-neutral-200/60`, { paddingTop: insets.top }]}>
      <View style={tw`flex-row items-center justify-between px-3 pb-3 pt-1`}>
        <Pressable
          onPress={onPressMenu}
          style={({ pressed }) => tw`flex-row items-center max-w-[70%] ${pressed ? "opacity-70" : ""}`}
        >
          <Text style={tw`text-lg font-semibold text-neutral-900`} numberOfLines={1}>
            {workspaceTitle}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#404040" style={tw`ml-1`} />
        </Pressable>

        <View style={tw`flex-row items-center gap-1`}>
          <Pressable hitSlop={10} onPress={onPressInbox} style={tw`p-2 rounded-full`}>
            <Ionicons name="file-tray-outline" size={22} color="#262626" />
          </Pressable>
          <Pressable hitSlop={10} onPress={onPressMenu} style={tw`p-2 rounded-full`}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#262626" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
