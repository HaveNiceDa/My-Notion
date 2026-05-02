import { Ionicons } from "@expo/vector-icons";
import { View, useTheme } from "tamagui";
import tw from "twrnc";

import type { PageIconKind } from "../types";

type Props = {
  kind: PageIconKind;
  size?: number;
};

export function PageIcon({ kind, size = 18 }: Props) {
  const theme = useTheme();
  const name = (() => {
    switch (kind) {
      case "database":
        return "grid-outline" as const;
      case "folder":
        return "folder-outline" as const;
      default:
        return "document-text-outline" as const;
    }
  })();

  return (
    <View
      style={[
        tw`w-8 h-8 rounded-lg items-center justify-center`,
        { backgroundColor: theme.backgroundHover.val },
      ]}
    >
      <Ionicons name={name} size={size} color={theme.placeholderColor.val} />
    </View>
  );
}
