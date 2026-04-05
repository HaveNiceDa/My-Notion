"use client";

import { useState } from "react";
import { useMemoizedFn } from "ahooks";
import { useEdgeStore } from "@/src/lib/edgestore";

interface UploadingFile {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  url: string | null;
  error: string | null;
  status: "uploading" | "completed" | "error" | "cancelled";
  abortController?: AbortController;
}

const useImageUpload = (
  t?: (key: string, options?: Record<string, any>) => string,
) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const { edgestore } = useEdgeStore();

  // 生成文件预览URL
  const createPreviewUrl = useMemoizedFn((file: File) => {
    return URL.createObjectURL(file);
  });

  // 释放预览URL以避免内存泄漏
  const revokePreviewUrl = useMemoizedFn((url: string) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  });

  // 翻译函数，默认返回原文
  const translate = (key: string, options?: Record<string, any>) => {
    if (t) {
      return t(key, options);
    }
    // 默认翻译
    const defaultTranslations: Record<string, string> = {
      "imageUpload.supportedFormats": "只支持JPEG、PNG、GIF和WebP格式的图片",
      "imageUpload.maxSize": "图片大小不能超过5MB",
      "imageUpload.uploadFailed": "上传失败，请重试",
    };
    return defaultTranslations[key] || key;
  };

  const generateUniqueId = useMemoizedFn(() => {
    return Math.random().toString(36).substr(2, 9);
  });

  const validateFile = useMemoizedFn(
    (file: File): { valid: boolean; error?: string } => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];

      if (!allowedTypes.includes(file.type)) {
        return {
          valid: false,
          error: translate("imageUpload.supportedFormats"),
        };
      }

      if (file.size > maxSize) {
        return { valid: false, error: translate("imageUpload.maxSize") };
      }

      return { valid: true };
    },
  );

  const uploadFile = useMemoizedFn(async (file: File) => {
    const id = generateUniqueId();
    const validation = validateFile(file);

    if (!validation.valid) {
      const errorFile: UploadingFile = {
        id,
        file,
        previewUrl: createPreviewUrl(file),
        progress: 0,
        url: null,
        error: validation.error || null,
        status: "error",
      };
      setUploadingFiles((prev) => [...prev, errorFile]);
      return;
    }

    const abortController = new AbortController();
    const newFile: UploadingFile = {
      id,
      file,
      previewUrl: createPreviewUrl(file),
      progress: 0,
      url: null,
      error: null,
      status: "uploading",
      abortController,
    };

    setUploadingFiles((prev) => [...prev, newFile]);

    try {
      const { url } = await edgestore.publicFiles.upload({
        file,
        onProgressChange: (progress: number) => {
          // 确保进度值在 0-100 之间
          const actualProgress = Math.min(100, Math.round(progress));
          // 立即更新到实际进度
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === id ? { ...f, progress: actualProgress } : f,
            ),
          );
        },
        signal: abortController.signal,
      });

      // 确保进度显示为100%
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                progress: 100,
                url,
                status: "completed",
                abortController: undefined,
              }
            : f,
        ),
      );
    } catch (error) {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                error: translate("imageUpload.uploadFailed"),
                status: "error",
                abortController: undefined,
              }
            : f,
        ),
      );
    }
  });

  const uploadFiles = useMemoizedFn((files: File[]) => {
    const maxFiles = 10;
    if (files.length > maxFiles) {
      // 只取前10张图片
      const selectedFiles = files.slice(0, maxFiles);
      // 显示toast提示
      import("sonner").then(({ toast }) => {
        import("next-intl").then(({ useTranslations }) => {
          const t = useTranslations("AI");
          toast.info(t("maxImagesUploaded", { count: maxFiles }));
        });
      });
      selectedFiles.forEach((file) => uploadFile(file));
    } else {
      files.forEach((file) => uploadFile(file));
    }
  });

  const cancelUpload = useMemoizedFn((id: string) => {
    setUploadingFiles((prev) => {
      const fileToCancel = prev.find((f) => f.id === id);
      if (fileToCancel?.abortController) {
        fileToCancel.abortController.abort();
      }
      if (fileToCancel?.previewUrl) {
        revokePreviewUrl(fileToCancel.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  });

  const removeFile = useMemoizedFn(async (id: string) => {
    setUploadingFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      // 如果文件正在上传，取消上传
      if (fileToRemove?.abortController) {
        fileToRemove.abortController.abort();
      }
      // 如果文件已上传完成，从EdgeStore删除
      if (fileToRemove?.status === "completed" && fileToRemove.url) {
        // 使用url参数删除文件
        edgestore.publicFiles.delete({ url: fileToRemove.url }).catch(() => {
          console.log("删除文件失败");
        });
      }
      if (fileToRemove?.previewUrl) {
        revokePreviewUrl(fileToRemove.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  });

  const getCompletedFiles = useMemoizedFn(() => {
    return uploadingFiles
      .filter((f) => f.status === "completed")
      .map((f) => f.url)
      .filter(Boolean) as string[];
  });

  const clearFiles = useMemoizedFn(() => {
    setUploadingFiles((prev) => {
      prev.forEach((file) => {
        if (file.previewUrl) {
          revokePreviewUrl(file.previewUrl);
        }
      });
      return [];
    });
  });

  return {
    uploadingFiles,
    uploadFiles,
    cancelUpload,
    removeFile,
    getCompletedFiles,
    clearFiles,
  };
};

export { useImageUpload };
export type { UploadingFile };
