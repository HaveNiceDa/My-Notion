import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import tw from "twrnc";

type Props = {
  onPressSearch?: () => void;
  onPressAi?: () => void;
  onPressNewPage?: () => void;
};

export function HomeBottomBar({ onPressSearch, onPressAi, onPressNewPage }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        tw`absolute left-0 right-0 bg-[#f7f7f5]/95 border-t border-neutral-200/70 px-3 pt-2`,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={tw`flex-row items-center gap-2`}>
        <Pressable
          onPress={onPressSearch}
          style={({ pressed }) => tw`p-2 rounded-full ${pressed ? "bg-black/5" : ""}`}
          accessibilityLabel="搜索"
        >
          <Ionicons name="search" size={24} color="#262626" />
        </Pressable>

        <Pressable
          onPress={onPressAi}
          style={({ pressed }) =>
            tw`flex-1 flex-row items-center bg-white border border-neutral-200 rounded-full px-4 py-2.5 gap-2 ${pressed ? "opacity-90" : ""}`
          }
        >
          <Ionicons name="sparkles" size={18} color="#7c3aed" />
          <Text style={tw`text-neutral-500 text-sm flex-1`}>万事问 AI</Text>
        </Pressable>

        <Pressable
          onPress={onPressNewPage}
          style={({ pressed }) =>
            tw`w-11 h-11 rounded-xl bg-neutral-900 items-center justify-center ${pressed ? "opacity-80" : ""}`
          }
          accessibilityLabel="新建页面"
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
