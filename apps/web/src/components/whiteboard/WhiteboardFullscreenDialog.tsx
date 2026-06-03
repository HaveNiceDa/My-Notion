"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { WhiteboardEditor } from "./WhiteboardEditor";

interface WhiteboardFullscreenDialogProps {
  whiteboardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhiteboardFullscreenDialog({
  whiteboardId,
  open,
  onOpenChange,
}: WhiteboardFullscreenDialogProps) {
  const id = whiteboardId as Id<"whiteboards">;
  const whiteboard = useQuery(api.whiteboards.getById, open ? { whiteboardId: id } : "skip");
  const updateScene = useMutation(api.whiteboards.updateScene);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden border-0 p-0 sm:rounded-none [&>button:last-child]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{whiteboard?.title ?? "画板"}</DialogTitle>
          <DialogDescription>
            全屏画板编辑器，编辑完成后返回文档。
          </DialogDescription>
        </DialogHeader>
        {whiteboard ? (
          <WhiteboardEditor
            title={whiteboard.title}
            sceneJson={whiteboard.sceneJson}
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
      </DialogContent>
    </Dialog>
  );
}
