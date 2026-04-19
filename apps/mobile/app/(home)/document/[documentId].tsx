import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spinner, View } from "tamagui";
import tw, { style as twStyle } from "twrnc";
import {
  RichText,
  Toolbar,
  useEditorBridge,
  useEditorContent,
} from "@10play/tentap-editor";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export default function DocumentDetailRoute() {
  const { t } = useTranslation();
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const id = documentId as Id<"documents">;
  const doc = useQuery(api.documents.getById, { documentId: id });

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent: "Start editing!",
  });

  if (doc === undefined) {
    return (
      <View style={tw`flex-1 bg-\$background items-center justify-center`}>
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <RichText editor={editor} />
      <KeyboardAvoidingView
        behavior={"padding"}
        style={{
          position: "absolute",
          width: "100%",
          bottom: 0,
        }}
      >
        <Toolbar editor={editor} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
