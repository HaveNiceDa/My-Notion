"use client";

import { Spinner } from "@/src/components/spinner";
import { useConvexAuth } from "convex/react";
import { redirect } from "next/navigation";
import React, { useEffect } from "react";
import { Navigation } from "./_components/Navigation";
import { SearchCommand } from "@/src/components/search-command";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const t = useTranslations();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否按下了 Ctrl+S 或 Command+S
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // 阻止浏览器默认保存行为
        handleSave();
      }
    };

    // 添加事件监听器
    window.addEventListener("keydown", handleKeyDown);

    // 清理事件监听器
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSave = () => {
    // 显示保存中提示
    const toastId = toast.loading(t("common.saving"), {
      duration: 500
    });

    // 500ms后显示保存成功提示
    setTimeout(() => {
      toast.success(t("common.saved"), {
        id: toastId
      });
    }, 500);
  };

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
      <main className="flex-1 h-full overflow-y-auto">
        <SearchCommand />
        {children}
      </main>
    </div>
  );
}
