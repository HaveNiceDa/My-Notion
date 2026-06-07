"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@notion/business/utils";

import { WhiteboardEditor } from "./WhiteboardEditor";

type RemoteSceneState = {
  sceneObjectUrl: string;
  assetVersion?: number;
  sceneJson?: string;
  error?: boolean;
};

interface WhiteboardFullscreenDialogProps {
  whiteboardId: string;
  initialWhiteboard?: {
    title: string;
    sceneJson: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhiteboardFullscreenDialog({
  whiteboardId,
  initialWhiteboard,
  open,
  onOpenChange,
}: WhiteboardFullscreenDialogProps) {
  const t = useTranslations("Whiteboard");
  const id = whiteboardId as Id<"whiteboards">;
  const whiteboard = useQuery(api.whiteboards.getSceneById, open ? { whiteboardId: id } : "skip");
  const updateScene = useMutation(api.whiteboards.updateScene);
  const [remoteScene, setRemoteScene] = useState<RemoteSceneState | null>(null);
  const sceneObjectUrl = whiteboard?.sceneObjectUrl;
  const sceneAssetVersion = whiteboard?.assetVersion;

  useEffect(() => {
    if (!open || !sceneObjectUrl) return;

    let cancelled = false;
    void fetch(sceneObjectUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load whiteboard scene: ${response.status}`);
        }
        return response.text();
      })
      .then((sceneJson) => {
        if (!cancelled) {
          setRemoteScene({ sceneObjectUrl, assetVersion: sceneAssetVersion, sceneJson });
        }
      })
      .catch((error) => {
        console.error("[WhiteboardFullscreenDialog] failed to load scene object", error);
        if (!cancelled) {
          setRemoteScene({ sceneObjectUrl, assetVersion: sceneAssetVersion, error: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, sceneObjectUrl, sceneAssetVersion]);

  const activeTitle = whiteboard?.title ?? initialWhiteboard?.title;
  const matchedRemoteScene = remoteScene?.sceneObjectUrl === sceneObjectUrl
    && remoteScene?.assetVersion === sceneAssetVersion
    ? remoteScene
    : null;
  const activeSceneJson = sceneObjectUrl
    ? matchedRemoteScene?.sceneJson ?? (matchedRemoteScene?.error ? whiteboard?.sceneJson : undefined)
    : whiteboard?.sceneJson ?? initialWhiteboard?.sceneJson;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[99999] bg-background",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-[99999] h-dvh w-screen overflow-hidden bg-background outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
            "duration-200",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {activeTitle ?? t("title")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t("fullscreenDescription")}
          </DialogPrimitive.Description>
          {activeTitle && activeSceneJson ? (
            <WhiteboardEditor
              title={activeTitle}
              sceneJson={activeSceneJson}
              onClose={() => onOpenChange(false)}
              onRename={async ({ title, sceneJson }) => {
                await updateScene({
                  whiteboardId: id,
                  title,
                  sceneJson,
                });
              }}
              onSave={async ({ sceneJson, thumbnailDataUrl }) => {
                await updateScene({
                  whiteboardId: id,
                  sceneJson,
                  thumbnailDataUrl,
                });
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("loading")}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
