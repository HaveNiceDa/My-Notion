import { useMutation } from "convex/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { Dialog, Text, View, useTheme } from "tamagui";
import { Ionicons } from "@expo/vector-icons";
import tw from "twrnc";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

import { RenameDialog } from "./rename-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast-provider";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Doc<"documents">;
  onDeleted?: () => void;
};

export function DocumentActionSheet({
  open,
  onOpenChange,
  document,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();

  const archive = useMutation(api.documents.archive);
  const toggleStar = useMutation(api.documents.toggleStar);
  const toggleKnowledgeBase = useMutation(api.documents.toggleKnowledgeBase);

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleArchive = async () => {
    try {
      await archive({ id: document._id });
      toast.showSuccess(t("Menu.noteMovedToTrash"));
      onDeleted?.();
    } catch (error) {
      console.error("Failed to archive:", error);
      toast.showError(t("Menu.failedToArchiveNote"));
    }
  };

  const handleToggleStar = async () => {
    try {
      await toggleStar({
        id: document._id,
        isStarred: !document.isStarred,
      });
      toast.showSuccess(
        document.isStarred
          ? t("Publish.unstarredSuccess")
          : t("Publish.starredSuccess"),
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to toggle star:", error);
      toast.showError(t("Publish.errorToToggleStar"));
    }
  };

  const handleToggleKnowledgeBase = async () => {
    try {
      await toggleKnowledgeBase({
        id: document._id,
        isInKnowledgeBase: !document.isInKnowledgeBase,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to toggle knowledge base:", error);
    }
  };

  const handleClose = () => onOpenChange(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} modal>
        <Dialog.Portal>
          <Dialog.Overlay opacity={0.4} />
          <Dialog.Content
            bordered
            elevate
            width={300}
            bg="$background"
            style={tw`overflow-hidden p-0`}
          >
            <View px="$4" pt="$4" pb="$3">
              <Text
                style={tw`text-base font-semibold`}
                numberOfLines={1}
              >
                {document.title}
              </Text>
            </View>

            <Pressable
              onPress={handleToggleStar}
              style={({ pressed }) => [
                tw`flex-row items-center gap-3 px-4 py-3`,
                pressed
                  ? { backgroundColor: theme.backgroundHover.val }
                  : null,
              ]}
            >
              <Ionicons
                name={document.isStarred ? "star" : "star-outline"}
                size={20}
                color={theme.color.val}
              />
              <Text style={tw`text-[15px] flex-1`}>
                {document.isStarred
                  ? t("Publish.unstarredSuccess")
                  : t("Publish.starredSuccess")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleToggleKnowledgeBase}
              style={({ pressed }) => [
                tw`flex-row items-center gap-3 px-4 py-3`,
                pressed
                  ? { backgroundColor: theme.backgroundHover.val }
                  : null,
              ]}
            >
              <Ionicons
                name={
                  document.isInKnowledgeBase ? "book" : "book-outline"
                }
                size={20}
                color={theme.color.val}
              />
              <Text style={tw`text-[15px] flex-1`}>
                {document.isInKnowledgeBase
                  ? t("Item.delete")
                  : t("Navigation.knowledgeBase")}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onOpenChange(false);
                setRenameOpen(true);
              }}
              style={({ pressed }) => [
                tw`flex-row items-center gap-3 px-4 py-3`,
                pressed
                  ? { backgroundColor: theme.backgroundHover.val }
                  : null,
              ]}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={theme.color.val}
              />
              <Text style={tw`text-[15px] flex-1`}>
                {t("Menu.rename")}
              </Text>
            </Pressable>

            <View
              style={{
                height: 1,
                backgroundColor: theme.borderColor.val,
                marginHorizontal: 16,
              }}
            />

            <Pressable
              onPress={() => {
                onOpenChange(false);
                setDeleteConfirmOpen(true);
              }}
              style={({ pressed }) => [
                tw`flex-row items-center gap-3 px-4 py-3`,
                pressed
                  ? { backgroundColor: theme.backgroundHover.val }
                  : null,
              ]}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[tw`text-[15px]`, { color: "#ef4444" }]}>
                {t("Menu.delete")}
              </Text>
            </Pressable>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        documentId={document._id}
        currentTitle={document.title}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        destructive
        onConfirm={handleArchive}
      />
    </>
  );
}
