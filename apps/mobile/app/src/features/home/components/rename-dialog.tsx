import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, Input, Text, View, useTheme, type ColorTokens } from "tamagui";
import tw from "twrnc";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: Id<"documents">;
  currentTitle: string;
};

export function RenameDialog({
  open,
  onOpenChange,
  documentId,
  currentTitle,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useMutation(api.documents.update);
  const [newTitle, setNewTitle] = useState(currentTitle);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setNewTitle(currentTitle);
      }
      onOpenChange(nextOpen);
    },
    [currentTitle, onOpenChange],
  );

  const handleSave = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setIsLoading(true);
    try {
      await update({ id: documentId, title: trimmed });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to rename:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen} modal>
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
          <Dialog.Title>{t("Modals.rename.renameDocument")}</Dialog.Title>
          <Input
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder={t("Modals.rename.documentName")}
            placeholderTextColor={theme.placeholderColor.val as ColorTokens}
            autoFocus
            selectTextOnFocus
          />
          <View flexDirection="row" gap="$2">
            <Button
              flex={1}
              onPress={() => onOpenChange(false)}
              disabled={isLoading}
              bg="$background"
            >
              <Text style={tw`text-center`}>
                {t("Modals.rename.cancel")}
              </Text>
            </Button>
            <Button
              flex={1}
              onPress={handleSave}
              disabled={isLoading || !newTitle.trim()}
              bg="$primary"
            >
              <Text style={[tw`text-center`, { color: "#fff" }]}>
                {isLoading
                  ? t("Modals.rename.renaming")
                  : t("Modals.rename.save")}
              </Text>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
