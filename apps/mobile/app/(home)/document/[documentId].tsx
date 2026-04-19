import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Spinner, Text, View, useTheme } from "tamagui";
import tw from "twrnc";
import {
  RichText,
  useEditorBridge,
  useEditorContent,
} from "@10play/tentap-editor";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  getEditorContentFromStoredContent,
  getPlainTextFromStoredContent,
  serializePlainTextToBlockNote,
} from "@/features/documents/content-compat";

const SAVE_DELAY_MS = 700;

export default function DocumentDetailRoute() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const id = documentId as Id<"documents">;
  const doc = useQuery(api.documents.getById, { documentId: id });
  const update = useMutation(api.documents.update);

  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTitleRef = useRef<string>("");
  const lastSavedContentRef = useRef<string>("");
  const titleLoadedForIdRef = useRef<string | null>(null);
  const contentLoadedForIdRef = useRef<string | null>(null);
  const loadedPlainTextRef = useRef<string>("");

  const initialContent = useMemo(
    () => getEditorContentFromStoredContent(doc?.content),
    [doc?.content],
  );

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent,
  });
  const editorText = useEditorContent(editor, {
    type: "text",
    debounceInterval: 300,
  });

  useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!doc) return;

    if (titleLoadedForIdRef.current !== doc._id) {
      setTitle(doc.title);
      lastSavedTitleRef.current = doc.title;
      titleLoadedForIdRef.current = doc._id;
    }

    if (contentLoadedForIdRef.current !== doc._id) {
      const nextEditorContent = getEditorContentFromStoredContent(doc.content);
      editor.setContent(nextEditorContent);
      lastSavedContentRef.current = doc.content ?? "";
      contentLoadedForIdRef.current = doc._id;
      loadedPlainTextRef.current = getPlainTextFromStoredContent(doc.content);
    }
  }, [doc, editor]);

  useEffect(() => {
    if (!doc || editorText === undefined) return;
    if (editorText === loadedPlainTextRef.current) return;

    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
    }

    contentTimerRef.current = setTimeout(async () => {
      const nextContent = serializePlainTextToBlockNote(editorText);
      if (nextContent === lastSavedContentRef.current) return;

      setSaveState("saving");
      try {
        await update({ id, content: nextContent });
        lastSavedContentRef.current = nextContent;
        loadedPlainTextRef.current = editorText;
        setSaveState("saved");
      } catch (error) {
        setSaveState("idle");
        console.error("Failed to save content:", error);
      }
    }, SAVE_DELAY_MS);
  }, [doc, editorText, id, update]);

  const scheduleTitleSave = useCallback(
    (nextTitle: string) => {
      if (!doc) return;

      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
      }

      titleTimerRef.current = setTimeout(async () => {
        const trimmed = nextTitle.trim() || "Untitled";
        if (trimmed === lastSavedTitleRef.current) return;

        setSaveState("saving");
        try {
          await update({ id, title: trimmed });
          lastSavedTitleRef.current = trimmed;
          setSaveState("saved");
        } catch (error) {
          setSaveState("idle");
          console.error("Failed to save title:", error);
        }
      }, SAVE_DELAY_MS);
    },
    [doc, id, update],
  );

  if (doc === undefined) {
    return (
      <View flex={1} bg="$background" items="center" justify="center">
        <Spinner size="large" />
      </View>
    );
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "Saved"
        : "Editing";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <Stack.Screen
        options={{ headerShown: false, title: doc.title || "Untitled" }}
      />

      <View flex={1} bg="$background">
        <View
          px="$3"
          pt="$2"
          pb="$3"
          style={{
            borderBottomWidth: 1,
            borderBottomColor: theme.borderColor.val,
            backgroundColor: theme.backgroundHover.val,
          }}
        >
          <View style={tw`flex-row items-center justify-between`}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => [
                tw`w-10 h-10 rounded-full items-center justify-center`,
                pressed ? { backgroundColor: theme.backgroundPress.val } : null,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={theme.color.val} />
            </Pressable>

            <Text color="$placeholderColor" style={tw`text-xs font-semibold`}>
              {saveLabel}
            </Text>
          </View>

          <TextInput
            value={title}
            onChangeText={(nextTitle) => {
              setTitle(nextTitle);
              scheduleTitleSave(nextTitle);
            }}
            placeholder="Untitled"
            placeholderTextColor={theme.placeholderColor.val}
            style={{
              color: theme.color.val,
              fontSize: 28,
              fontWeight: "700",
              marginTop: 12,
              paddingVertical: 8,
            }}
          />
        </View>

        <View flex={1} bg="$background">
          <RichText editor={editor} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingHorizontal: 16,
            paddingTop: 12,
            backgroundColor: theme.background.val,
            borderTopWidth: 1,
            borderTopColor: theme.borderColor.val,
          }}
        >
          <Text color="$placeholderColor" style={tw`text-xs leading-4`}>
            当前移动端会把内容转换为 BlockNote 兼容段落再保存，先保证和 web
            端数据互通。
          </Text>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
