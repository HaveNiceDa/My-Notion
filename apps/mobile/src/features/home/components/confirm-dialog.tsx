import { useTranslation } from "react-i18next";
import { Button, Dialog, Text, View } from "tamagui";
import tw from "twrnc";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
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
          <Dialog.Title>
            {title ?? t("Modals.confirm.areYouAbsolutelySure")}
          </Dialog.Title>
          <Text color="$placeholderColor" style={tw`text-sm`}>
            {description ?? t("Modals.confirm.thisActionCannotBeUndone")}
          </Text>
          <View flexDirection="row" gap="$2">
            <Button
              flex={1}
              onPress={() => onOpenChange(false)}
              bg="$background"
            >
              <Text style={tw`text-center`}>
                {t("Modals.confirm.cancel")}
              </Text>
            </Button>
            <Button
              flex={1}
              theme={destructive ? "red" : undefined}
              onPress={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              <Text style={tw`text-center`}>
                {confirmLabel ?? t("Modals.confirm.confirm")}
              </Text>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
