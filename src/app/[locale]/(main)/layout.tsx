"use client";

import { Spinner } from "@/src/components/spinner";
import { useConvexAuth } from "convex/react";
import { redirect } from "next/navigation";
import React, { useEffect } from "react";
import { Navigation } from "./_components/Navigation";
import { SearchCommand } from "@/src/components/search-command";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useUser } from "@clerk/clerk-react";
import { useVectorStoreStore } from "@/src/lib/store/use-vector-store-store";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useUser();
  const { setUserLoadingStatus, userLoadingStatus } = useVectorStoreStore();
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

  // 提前加载向量存储
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Check if vector store is already loading or loaded for this user
    const currentStatus = userLoadingStatus[user.id];
    if (currentStatus === 'loading' || currentStatus === 'success') {
      return;
    }

    const initializeVectorStore = async () => {
      try {
        setUserLoadingStatus(user.id, 'loading');
        console.log(`[MainLayout] 开始提前加载向量存储: userId=${user.id}`);

        // 动态导入 rag 模块
        const { initKnowledgeBaseVectorStore } = await import('@/src/lib/rag/rag');
        
        // 初始化向量存储（快速模式，跳过文档检查）
        await initKnowledgeBaseVectorStore(user.id, true);
        
        setUserLoadingStatus(user.id, 'success');
        console.log(`[MainLayout] 向量存储提前加载完成: userId=${user.id}`);
      } catch (error) {
        console.error('[MainLayout] 向量存储提前加载失败:', error);
        setUserLoadingStatus(user.id, 'error');
      }
    };

    // 启动异步初始化
    initializeVectorStore();
  }, [isAuthenticated, user, userLoadingStatus, setUserLoadingStatus]);

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
