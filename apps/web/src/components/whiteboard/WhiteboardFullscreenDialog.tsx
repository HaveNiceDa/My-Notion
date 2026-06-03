"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@notion/business/utils";

import { WhiteboardEditor } from "./WhiteboardEditor";

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
  const id = whiteboardId as Id<"whiteboards">;
  const whiteboard = useQuery(api.whiteboards.getById, open ? { whiteboardId: id } : "skip");
  const activeWhiteboard = whiteboard ?? initialWhiteboard;
  const updateScene = useMutation(api.whiteboards.updateScene);

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
            {activeWhiteboard?.title ?? "画板"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            全屏画板编辑器，编辑完成后返回文档。
          </DialogPrimitive.Description>
        {activeWhiteboard ? (
          <WhiteboardEditor
            title={activeWhiteboard.title}
            sceneJson={activeWhiteboard.sceneJson}
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
            正在加载画板...
          </div>
        )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
