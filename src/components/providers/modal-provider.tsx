"use client";

import { useEffect, useState } from "react";

import { SettingsModal } from "@/src/components/modals/settings-modal";
import { CoverImageModal } from "@/src/components/modals/cover-image-modal";

export function ModalProvider() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
