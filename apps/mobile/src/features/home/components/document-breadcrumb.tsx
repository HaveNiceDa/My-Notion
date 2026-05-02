import { useQuery } from "convex/react";
import { useRouter, type Href } from "expo-router";
import { Pressable } from "react-native";
import { Text, View, useTheme } from "tamagui";
import tw from "twrnc";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type Props = {
  documentId: Id<"documents">;
};

export function DocumentBreadcrumb({ documentId }: Props) {
  const theme = useTheme();
  const router = useRouter();

  const documentPath = useQuery(api.documents.getDocumentPath, {
    documentId,
  });

  if (!documentPath || documentPath.length <= 1) return null;

  const ancestors = documentPath.slice(0, -1);

  if (ancestors.length === 0) return null;

  const handleNavigate = (docId: Id<"documents">) => {
    router.push(`/(home)/document/${docId}` as Href);
  };

  const displayAncestors =
    ancestors.length > 3
      ? [ancestors[0], { _id: "..." as Id<"documents">, title: "..." }, ancestors[ancestors.length - 1]]
      : ancestors;

  return (
    <View style={tw`flex-row items-center flex-wrap mt-1`}>
      {displayAncestors.map((doc, index) => (
        <View key={`${doc._id}-${index}`} style={tw`flex-row items-center`}>
          {index > 0 && (
            <Text
              style={[tw`text-xs mx-1`, { color: theme.placeholderColor.val }]}
            >
              /
            </Text>
          )}
          <Pressable
            onPress={() => {
              if (doc._id !== "...") {
                handleNavigate(doc._id);
              }
            }}
            hitSlop={4}
          >
            <Text
              numberOfLines={1}
              style={[
                tw`text-xs`,
                {
                  color: theme.placeholderColor.val,
                  maxWidth: 100,
                },
              ]}
            >
              {doc.title}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
