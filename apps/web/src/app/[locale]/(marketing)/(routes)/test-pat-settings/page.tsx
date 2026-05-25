"use client";

import { useEffect } from "react";
import { useSettings } from "@notion/business/hooks";

export default function PatSettingsTestPage() {
  const onOpen = useSettings((state) => state.onOpen);

  useEffect(() => {
    onOpen();
  }, [onOpen]);

  return (
    <main className="p-6">
      <h1>Playwright PAT settings test</h1>
    </main>
  );
}
