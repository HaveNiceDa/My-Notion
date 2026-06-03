"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { WhiteboardFullscreenDialog } from "./WhiteboardFullscreenDialog";

interface WhiteboardThumbnailProps {
  whiteboardId: string;
  title: string;
  thumbnailUrl?: string;
}

export function WhiteboardThumbnail({
  whiteboardId,
  title,
  thumbnailUrl,
}: WhiteboardThumbnailProps) {
  const [open, setOpen] = useState(false);
  const whiteboard = useQuery(api.whiteboards.getById, {
    whiteboardId: whiteboardId as Id<"whiteboards">,
  });
  const isLoading = whiteboard === undefined;
  const displayTitle = whiteboard?.title ?? (title || "未命名画板");
  const thumbnail = whiteboard?.thumbnailDataUrl ?? thumbnailUrl;

  return (
    <div contentEditable={false} className="my-4 w-full">
      <button
        type="button"
        className="group block w-full overflow-hidden rounded-xl border bg-white text-left shadow-sm transition duration-200 hover:border-primary/40 hover:shadow-md"
        aria-label={`打开画板：${displayTitle}`}
        onClick={() => setOpen(true)}
      >
        <div className="relative aspect-[16/9] min-h-[280px] w-full bg-white">
          {isLoading ? (
            <div className="flex h-full items-center justify-center bg-muted/20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
            </div>
          ) : thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt={displayTitle} className="h-full w-full object-contain" />
          ) : (
            <div className="h-full bg-white" />
          )}
        </div>
      </button>
      <WhiteboardFullscreenDialog
        whiteboardId={whiteboardId}
        initialWhiteboard={whiteboard}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
