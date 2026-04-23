import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  TextInput,
  Image,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Spinner, Text, View, useTheme, Dialog, Input, Button } from "tamagui";
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
import { IconPicker } from "@/features/home/components/icon-picker";
import { DocumentBreadcrumb } from "@/features/home/components/document-breadcrumb";

const SAVE_DELAY_MS = 700;

function getWebOrigin(): string {
  return Constants.expoConfig?.extra?.webUrl ?? "https://notion-j9zj.vercel.app";
}

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
  const removeCoverImage = useMutation(api.documents.removeCoverImage);
  const removeIcon = useMutation(api.documents.removeIcon);

  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [coverUrlDialogOpen, setCoverUrlDialogOpen] = useState(false);
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

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

  const handleSetIcon = async (icon: string) => {
    try {
      await update({ id, icon });
      setIconPickerOpen(false);
    } catch (error) {
      console.error("Failed to set icon:", error);
    }
  };

  const handleRemoveIcon = async () => {
    try {
      await removeIcon({ id });
      setIconPickerOpen(false);
    } catch (error) {
      console.error("Failed to remove icon:", error);
    }
  };

  const handleSetCoverUrl = async () => {
    const url = coverUrlInput.trim();
    if (!url) return;
    try {
      await update({ id, coverImage: url });
      setCoverUrlDialogOpen(false);
      setCoverUrlInput("");
    } catch (error) {
      console.error("Failed to set cover image:", error);
      toast.showError(t("Cover.change"));
    }
  };

  const handleRemoveCover = async () => {
    try {
      await removeCoverImage({ id });
    } catch (error) {
      console.error("Failed to remove cover image:", error);
    }
  };

  const handleCopyLink = async () => {
    try {
      const origin = getWebOrigin();
      const url = `${origin}/preview/${id}`;
      await Clipboard.setStringAsync(url);
      toast.showSuccess(t("Publish.linkCopiedToClipboard"));
    } catch {
      toast.showError(t("Error.somethingWentWrong"));
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
        {doc.coverImage ? (
          <View style={{ position: "relative", height: 180 }}>
            <Image
              source={{ uri: doc.coverImage }}
              style={tw`w-full h-full`}
              resizeMode="cover"
            />
            <View
              style={{
                position: "absolute",
                bottom: 8,
                right: 12,
                flexDirection: "row",
                gap: 8,
              }}
            >
              <Pressable
                onPress={() => {
                  setCoverUrlInput(doc.coverImage ?? "");
                  setCoverUrlDialogOpen(true);
                }}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: theme.background.val,
                  borderWidth: 1,
                  borderColor: theme.borderColor.val,
                }}
              >
                <Text style={[tw`text-xs`, { color: theme.color.val }]}>
                  {t("Cover.change")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleRemoveCover}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: theme.background.val,
                  borderWidth: 1,
                  borderColor: theme.borderColor.val,
                }}
              >
                <Text style={[tw`text-xs`, { color: theme.color.val }]}>
                  {t("Cover.remove")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
                onPress={handleCopyLink}
                hitSlop={10}
                style={({ pressed }) => [
                  tw`w-10 h-10 rounded-full items-center justify-center`,
                  pressed ? { backgroundColor: theme.backgroundPress.val } : null,
                ]}
              >
                <Ionicons name="link-outline" size={20} color={theme.color.val} />
              </Pressable>

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

          <DocumentBreadcrumb documentId={id} />

          <View style={tw`flex-row items-center mt-2`}>
            <Pressable
              onPress={() => setIconPickerOpen(true)}
              hitSlop={4}
              style={tw`mr-2`}
            >
              {doc.icon ? (
                <Text style={tw`text-3xl`}>{doc.icon}</Text>
              ) : (
                <View
                  style={[
                    tw`w-9 h-9 rounded-lg items-center justify-center`,
                    { backgroundColor: theme.backgroundPress.val },
                  ]}
                >
                  <Ionicons name="happy-outline" size={20} color={theme.placeholderColor.val} />
                </View>
              )}
            </Pressable>

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
                paddingVertical: 8,
                flex: 1,
              }}
            />
          </View>

          {!doc.coverImage && (
            <View style={tw`flex-row gap-2 mt-1`}>
              <Pressable
                onPress={() => {
                  setCoverUrlInput("");
                  setCoverUrlDialogOpen(true);
                }}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: theme.backgroundPress.val,
                  },
                  pressed ? { opacity: 0.7 } : null,
                ]}
              >
                <Text style={[tw`text-xs`, { color: theme.placeholderColor.val }]}>
                  {t("Toolbar.addCover")}
                </Text>
              </Pressable>
              {!doc.icon && (
                <Pressable
                  onPress={() => setIconPickerOpen(true)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: theme.backgroundPress.val,
                    },
                    pressed ? { opacity: 0.7 } : null,
                  ]}
                >
                  <Text style={[tw`text-xs`, { color: theme.placeholderColor.val }]}>
                    {t("Toolbar.addIcon")}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
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

      <IconPicker
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        currentIcon={doc.icon}
        onSelectIcon={handleSetIcon}
        onRemoveIcon={doc.icon ? handleRemoveIcon : undefined}
      />

      <Dialog open={coverUrlDialogOpen} onOpenChange={setCoverUrlDialogOpen} modal>
        <Dialog.Portal>
          <Dialog.Overlay opacity={0.5} />
          <Dialog.Content
            bordered
            elevate
            width={320}
            gap="$3"
            bg="$backgroundHover"
            style={tw`rounded-3xl`}
          >
            <Dialog.Title>{t("Modals.coverImage.coverImage")}</Dialog.Title>
            <Input
              value={coverUrlInput}
              onChangeText={setCoverUrlInput}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor={theme.placeholderColor.val as any}
              autoFocus
              selectTextOnFocus
            />
            <View flexDirection="row" gap="$2">
              <Button
                flex={1}
                onPress={() => setCoverUrlDialogOpen(false)}
                bg="$background"
              >
                <Text style={tw`text-center`}>
                  {t("Modals.confirm.cancel")}
                </Text>
              </Button>
              <Button
                flex={1}
                onPress={handleSetCoverUrl}
                disabled={!coverUrlInput.trim()}
                bg="$primary"
              >
                <Text style={[tw`text-center`, { color: "#fff" }]}>
                  {t("Modals.confirm.confirm")}
                </Text>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </SafeAreaView>
  );
}
