import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spinner, Text, View } from "tamagui";
import tw, { style as twStyle } from "twrnc";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export default function DocumentDetailRoute() {
  const { t } = useTranslation();
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const id = documentId as Id<"documents">;
  const doc = useQuery(api.documents.getById, { documentId: id });

  return (
    <View flex={1} bg="$background">
      <View
        style={twStyle("flex-row items-center gap-1 px-2 pb-3 border-b border-neutral-200", {
          paddingTop: insets.top + 4,
        })}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => tw`p-2 rounded-lg ${pressed ? "bg-neutral-100" : ""}`}
          accessibilityLabel={t("Error.goBack")}
        >
          <Ionicons name="chevron-back" size={26} color="#171717" />
        </Pressable>
      </View>

      {doc === undefined ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <Spinner size="large" />
        </View>
      ) : (
        <View style={tw`px-4 pt-6 pb-24`}>
          <Text style={tw`text-3xl font-bold text-neutral-900`}>{doc.title}</Text>
          <Text style={tw`mt-6 text-sm text-neutral-500`}>
            {t("Home.documentPlaceholder")}
          </Text>
        </View>
      )}
    </View>
  );
}
