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
  serializeHtmlToBlockNote,
} from "@notion/business/content-compat";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/features/home/components/confirm-dialog";
import { useToast } from "@/features/home/components/toast-provider";

const SAVE_DELAY_MS = 700;

export default function DocumentDetailRoute() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { t } = useTranslation();
  const toast = useToast();

  const id = documentId as Id<"documents">;
  const doc = useQuery(api.documents.getById, { documentId: id });
  const update = useMutation(api.documents.update);
  const archive = useMutation(api.documents.archive);
  const toggleStar = useMutation(api.documents.toggleStar);

  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTitleRef = useRef<string>("");
  const lastSavedContentRef = useRef<string>("");
  const titleLoadedForIdRef = useRef<string | null>(null);
  const contentLoadedForIdRef = useRef<string | null>(null);
  const loadedHtmlRef = useRef<string>("");

  const initialContent = useMemo(
    () => getEditorContentFromStoredContent(doc?.content),
    [doc?.content],
  );

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent,
  });
  const editorHtml = useEditorContent(editor, {
    type: "html",
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
      loadedHtmlRef.current = getEditorContentFromStoredContent(doc.content);
    }
  }, [doc, editor]);

  useEffect(() => {
    if (!doc || editorHtml === undefined) return;
    if (editorHtml === loadedHtmlRef.current) return;

    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
    }

    contentTimerRef.current = setTimeout(async () => {
      const nextContent = serializeHtmlToBlockNote(editorHtml);
      if (nextContent === lastSavedContentRef.current) return;

      setSaveState("saving");
      try {
        await update({ id, content: nextContent });
        lastSavedContentRef.current = nextContent;
        loadedHtmlRef.current = editorHtml;
        setSaveState("saved");
      } catch (error) {
        setSaveState("idle");
        console.error("Failed to save content:", error);
      }
    }, SAVE_DELAY_MS);
  }, [doc, editorHtml, id, update]);

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

  const handleToggleStar = async () => {
    if (!doc) return;
    try {
      await toggleStar({ id, isStarred: !doc.isStarred });
      toast.showSuccess(
        doc.isStarred
          ? t("Publish.unstarredSuccess")
          : t("Publish.starredSuccess"),
      );
    } catch (error) {
      console.error("Failed to toggle star:", error);
      toast.showError(t("Publish.errorToToggleStar"));
    }
  };

  const handleArchive = async () => {
    try {
      await archive({ id });
      toast.showSuccess(t("Menu.noteMovedToTrash"));
      router.back();
    } catch (error) {
      console.error("Failed to archive:", error);
      toast.showError(t("Menu.failedToArchiveNote"));
    }
  };

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

            <View style={tw`flex-row items-center`}>
              <Pressable
                onPress={handleToggleStar}
                hitSlop={10}
                style={({ pressed }) => [
                  tw`w-10 h-10 rounded-full items-center justify-center`,
                  pressed ? { backgroundColor: theme.backgroundPress.val } : null,
                ]}
              >
                <Ionicons
                  name={doc.isStarred ? "star" : "star-outline"}
                  size={20}
                  color={doc.isStarred ? theme.primary.val : theme.color.val}
                />
              </Pressable>

              <Pressable
                onPress={() => setDeleteConfirmOpen(true)}
                hitSlop={10}
                style={({ pressed }) => [
                  tw`w-10 h-10 rounded-full items-center justify-center`,
                  pressed ? { backgroundColor: theme.backgroundPress.val } : null,
                ]}
              >
                <Ionicons name="trash-outline" size={20} color={theme.color.val} />
              </Pressable>
            </View>
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
      </View>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        destructive
        onConfirm={handleArchive}
      />
    </SafeAreaView>
  );
}
