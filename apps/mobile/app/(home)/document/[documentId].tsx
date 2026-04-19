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

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export default function DocumentDetailRoute() {
  const { t } = useTranslation();
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const id = documentId as Id<"documents">;
  const doc = useQuery(api.documents.getById, { documentId: id });

  if (doc === undefined) {
    return (
      <View style={tw`flex-1 bg-\$background items-center justify-center`}>
        <Spinner size="large" />
      </View>
    );
  }

  return <DocumentEditor doc={doc} t={t} router={router} insets={insets} />;
}

function DocumentEditor({
  doc,
  t,
  router,
  insets,
}: {
  doc: any;
  t: any;
  router: any;
  insets: any;
}) {
  const update = useMutation(api.documents.update);
  const [title, setTitle] = useState(doc.title);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (updates: { title?: string; content?: string }) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        void update({
          id: doc._id,
          ...updates,
        });
      }, 1000);
    },
    [doc._id, update],
  );

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent: doc.content,
  });

  // const editor = useEditor({
  //   placeholder: t("Home.documentPlaceholder"),
  //   initialContent: doc.content,
  // });

  const htmlContent = useEditorContent(editor, { type: "html" });

  useEffect(() => {
    if (htmlContent) {
      debouncedSave({ content: htmlContent });
    }
  }, [htmlContent, debouncedSave]);

  const onTitleChange = (text: string) => {
    setTitle(text);
    debouncedSave({ title: text });
  };

  return (
    <View flex={1} bg="$background">
      <View
        style={twStyle(
          "flex-row items-center gap-1 px-2 pb-3 border-b border-neutral-100",
          {
            paddingTop: insets.top + 4,
          },
        )}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) =>
            tw`p-2 rounded-lg ${pressed ? "bg-neutral-100" : ""}`
          }
          accessibilityLabel={t("Error.goBack")}
        >
          <Ionicons name="chevron-back" size={26} color="#171717" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={tw`flex-1`}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={tw`px-4 pt-6 pb-24`}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            value={title}
            onChangeText={onTitleChange}
            placeholder={t("Home.untitled")}
            style={tw`text-3xl font-bold text-neutral-900 mb-6`}
            multiline
          />

          <RichText editor={editor} style={tw`min-h-[300px]`} />
        </ScrollView>

        <Toolbar editor={editor} />
      </KeyboardAvoidingView>
    </View>
  );
}
