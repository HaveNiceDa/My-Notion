import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import {
  SafeAreaView,
} from "react-native-safe-area-context";
import { Spinner, Text, View, useTheme, Button, Image } from "tamagui";
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
import { validateCoverImage } from "@notion/business/validation";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/features/home/components/confirm-dialog";
import { useToast } from "@/features/home/components/toast-provider";
import { ChatModal } from "@/features/ai-chat/components/ChatModal";
import { IconPicker } from "@/features/home/components/icon-picker";
import { DocumentBreadcrumb } from "@/features/home/components/document-breadcrumb";
import {
  InlineImageUploadError,
  pickInlineImage,
  uploadFileToEdgeStore,
} from "@/lib/inline-image-upload";
import type { MobileCurrentDocument } from "@/lib/ai/agent-stream";

const SAVE_DELAY_MS = 700;
const EDITOR_COMMAND_SETTLE_MS = 120;

function getWebOrigin(): string {
  return Constants.expoConfig?.extra?.webUrl ?? "https://notion-j9zj.vercel.app";
}

export default function DocumentDetailRoute() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
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
  const [coverUploading, setCoverUploading] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTitleRef = useRef<string>("");
  const lastSavedContentRef = useRef<string>("");
  const titleLoadedForIdRef = useRef<string | null>(null);
  const contentLoadedForIdRef = useRef<string | null>(null);
  const loadedHtmlRef = useRef<string>("");
  const pendingEditorHtmlRef = useRef<string | null>(null);

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

  const saveEditorHtml = useCallback(
    async (editorHtmlToSave: string) => {
      const nextContent = serializeHtmlToBlockNote(editorHtmlToSave);
      if (nextContent === lastSavedContentRef.current) return true;

      setSaveState("saving");
      try {
        await update({ id, content: nextContent });
        lastSavedContentRef.current = nextContent;
        loadedHtmlRef.current = editorHtmlToSave;
        setSaveState("saved");
        return true;
      } catch (error) {
        setSaveState("idle");
        console.error("Failed to save content:", error);
        return false;
      }
    },
    [id, update],
  );

  const flushPendingContentSave = useCallback(async () => {
    const pendingEditorHtml = pendingEditorHtmlRef.current;
    if (!pendingEditorHtml) return;

    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
      contentTimerRef.current = null;
    }

    await saveEditorHtml(pendingEditorHtml);
    pendingEditorHtmlRef.current = null;
  }, [saveEditorHtml]);

  const flushEditorContentSave = useCallback(async () => {
    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
      contentTimerRef.current = null;
    }

    const latestEditorHtml = await editor.getHTML();
    pendingEditorHtmlRef.current = latestEditorHtml;
    const saved = await saveEditorHtml(latestEditorHtml);
    pendingEditorHtmlRef.current = null;
    return saved;
  }, [editor, saveEditorHtml]);

  useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!doc || editorHtml === undefined) return;
    if (editorHtml === loadedHtmlRef.current) return;

    pendingEditorHtmlRef.current = editorHtml;

    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
    }

    contentTimerRef.current = setTimeout(async () => {
      await saveEditorHtml(editorHtml);
      pendingEditorHtmlRef.current = null;
    }, SAVE_DELAY_MS);
  }, [doc, editorHtml, saveEditorHtml]);

  const scheduleTitleSave = useCallback(
    (nextTitle: string) => {
      if (!doc) return;

      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
      }

      titleTimerRef.current = setTimeout(async () => {
        const trimmed = nextTitle.trim() || t("Documents.untitled");
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
    [doc, id, t, update],
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

  const handleBack = async () => {
    await flushPendingContentSave();
    router.back();
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

  const handleRemoveCover = async () => {
    try {
      await removeCoverImage({ id });
    } catch (error) {
      console.error("Failed to remove cover image:", error);
    }
  };

  const handlePickImage = async () => {
    try {
      setCoverUploading(true);
      const { pickCoverImage } = await import(
        "@/lib/cover-image-upload"
      );
      const params = await pickCoverImage();
      if (!params) return;

      const validation = validateCoverImage(
        params,
        t("Toolbar.unsupportedImageType"),
        t("Toolbar.imageTooLarge"),
      );
      if (!validation.valid) {
        toast.showError(validation.error!);
        return;
      }

      const result = await uploadFileToEdgeStore(
        params.uri,
        params.type,
        params.name,
      );
      await update({ id, coverImage: result.url });
    } catch (error) {
      console.error("Failed to pick and upload image:", error);
      toast.showError(t("Error.somethingWentWrong"));
    } finally {
      setCoverUploading(false);
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

  const handleInsertImage = async () => {
    try {
      setImageUploading(true);
      const params = await pickInlineImage();
      if (!params) return;

      const validation = validateCoverImage(
        {
          type: params.mimeType,
          name: params.name,
          size: params.size,
        },
        t("Toolbar.unsupportedImageType"),
        t("Toolbar.imageTooLarge"),
      );
      if (!validation.valid) {
        toast.showError(validation.error!);
        return;
      }

      const result = await uploadFileToEdgeStore(
        params.uri,
        params.mimeType,
        params.name,
      );
      editor.setImage(result.url);
      await new Promise((resolve) => setTimeout(resolve, EDITOR_COMMAND_SETTLE_MS));
      const saved = await flushEditorContentSave();
      if (!saved) {
        toast.showError(t("Error.somethingWentWrong"));
        return;
      }
      toast.showSuccess(t("Toolbar.imageInserted"));
    } catch (error) {
      console.error("Failed to insert image:", error);
      if (error instanceof InlineImageUploadError) {
        if (error.code === "permission_denied") {
          toast.showError(t("Toolbar.imagePermissionDenied"));
          return;
        }
        toast.showError(t("Toolbar.imageUploadFailed"));
        return;
      }
      toast.showError(t("Toolbar.imageUploadFailed"));
    } finally {
      setImageUploading(false);
    }
  };

  const currentDocument = useMemo<MobileCurrentDocument>(() => {
    if (!doc) return null;

    return {
      id: doc._id,
      title: title.trim() || t("Documents.untitled"),
      // 优先传入编辑器里的最新内容，让“读取当前文档”不依赖防抖保存是否已完成。
      content: editorHtml === undefined
        ? doc.content ?? null
        : serializeHtmlToBlockNote(editorHtml),
    };
  }, [doc, editorHtml, title, t]);

  if (doc === undefined) {
    return (
      <View flex={1} bg="$background" items="center" justify="center">
        <Spinner size="large" />
      </View>
    );
  }

  const saveLabel =
    saveState === "saving"
      ? t("Documents.statusSaving")
      : saveState === "saved"
        ? t("Documents.statusSaved")
        : t("Documents.statusEditing");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <Stack.Screen
        options={{ headerShown: false, title: doc.title || t("Documents.untitled") }}
      />

      <View flex={1} bg="$background">
        {doc.coverImage ? (
          <View position="relative" height={180}>
            <Image
              src={doc.coverImage}
              width="100%"
              height="100%"
              objectFit="cover"
            />
            <View
              position="absolute"
              style={{ bottom: 8, right: 12 }}
              flexDirection="row"
              gap={8}
            >
              <Button
                size="$2"
                onPress={handlePickImage}
                disabled={coverUploading}
                bg="$background"
                borderWidth={1}
                borderColor="$borderColor"
                style={{ borderRadius: 8 }}
              >
                <Text fontSize="$1">
                  {coverUploading ? t("Cover.uploading") : t("Cover.change")}
                </Text>
              </Button>
              <Button
                size="$2"
                onPress={handleRemoveCover}
                bg="$background"
                borderWidth={1}
                borderColor="$borderColor"
                style={{ borderRadius: 8 }}
              >
                <Text fontSize="$1">
                  {t("Cover.remove")}
                </Text>
              </Button>
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
              onPress={handleBack}
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
                onPress={() => setAiChatOpen(true)}
                hitSlop={10}
                accessibilityLabel={t("AI.openAIChat")}
                style={({ pressed }) => [
                  tw`w-10 h-10 rounded-full items-center justify-center`,
                  pressed ? { backgroundColor: theme.backgroundPress.val } : null,
                ]}
              >
                <Ionicons name="sparkles-outline" size={20} color={theme.color.val} />
              </Pressable>

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
              placeholder={t("Documents.untitled")}
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
            <View flexDirection="row" gap="$1" mt="$1">
              <Button
                size="$2"
                onPress={handlePickImage}
                disabled={coverUploading}
                bg="$backgroundPress"
                style={{ borderRadius: 6 }}
              >
                <Text fontSize="$1" color="$placeholderColor">
                  {coverUploading ? t("Cover.uploading") : t("Toolbar.addCover")}
                </Text>
              </Button>
              {!doc.icon && (
                <Button
                  size="$2"
                  onPress={() => setIconPickerOpen(true)}
                  bg="$backgroundPress"
                  style={{ borderRadius: 6 }}
                >
                  <Text fontSize="$1" color="$placeholderColor">
                    {t("Toolbar.addIcon")}
                  </Text>
                </Button>
              )}
            </View>
          )}
          <View flexDirection="row" gap="$1" mt="$1">
            <Button
              size="$2"
              onPress={handleInsertImage}
              disabled={imageUploading}
              bg="$backgroundPress"
              style={{ borderRadius: 6 }}
            >
              {imageUploading ? (
                <ActivityIndicator size="small" color={theme.placeholderColor.val} />
              ) : (
                <Text fontSize="$1" color="$placeholderColor">
                  {t("Toolbar.insertImage")}
                </Text>
              )}
            </Button>
          </View>
        </View>

        <View flex={1} bg="$background">
          <RichText
            editor={editor}
            containerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 16,
              backgroundColor: theme.background.val,
            }}
            style={{ backgroundColor: theme.background.val }}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />
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

      <ChatModal
        visible={aiChatOpen}
        onClose={() => setAiChatOpen(false)}
        currentDocument={currentDocument}
      />
    </SafeAreaView>
  );
}
