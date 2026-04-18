import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import tw from "twrnc";

import type { PageIconKind } from "../types";

type Props = {
  kind: PageIconKind;
  size?: number;
};

export function PageIcon({ kind, size = 18 }: Props) {
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
    <View style={tw`w-8 h-8 rounded-md bg-neutral-200/80 items-center justify-center`}>
      <Ionicons name={name} size={size} color="#374151" />
    </View>
  );
}
