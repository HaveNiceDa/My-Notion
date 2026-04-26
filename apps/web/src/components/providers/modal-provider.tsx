"use client";

import { useSyncExternalStore } from "react";

import { SettingsModal } from "@/src/components/modals/settings-modal";
import { CoverImageModal } from "@/src/components/modals/cover-image-modal";

const emptySubscribe = () => () => {};

export function ModalProvider() {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <SettingsModal />
      <CoverImageModal />
    </>
  );
}
