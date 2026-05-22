"use client";

import { Spinner } from "@/src/components/spinner";
import { useConvexAuth } from "convex/react";
import { redirect } from "next/navigation";
import React, { useEffect } from "react";
import { Navigation } from "./_components/Navigation";
import { SearchCommand } from "@/src/components/search-command";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AIChatPanel } from "@/src/components/ai-chat/AIChatPanel";
import { AIFloatingButton } from "@/src/components/ai-chat/AIFloatingButton";
import { MainContentNavbar } from "./_components/MainContentNavbar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const t = useTranslations();

  const handleSave = React.useCallback(() => {
    const toastId = toast.loading(t("Common.saving"), {
      duration: 500
    });

    setTimeout(() => {
      toast.success(t("Common.saved"), {
        id: toastId
      });
    }, 500);
  }, [t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSave]);

  if (isLoading) {
    return (
      <div className="h-full flex justify-center items-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return redirect("/");
  }

  return (
    <div className="h-full flex dark:bg-[#1F1F1F]">
      <Navigation />
      <main className="relative flex-1 h-full overflow-y-auto min-w-0">
        <MainContentNavbar />
        <SearchCommand />
        {children}
      </main>
      <AIChatPanel />
      <AIFloatingButton />
    </div>
  );
}
