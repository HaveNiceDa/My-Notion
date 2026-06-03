"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { PenLine } from "lucide-react";
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
  const displayTitle = whiteboard?.title ?? (title || "未命名画板");
  const thumbnail = whiteboard?.thumbnailDataUrl ?? thumbnailUrl;

  return (
    <div contentEditable={false} className="my-4 w-full">
      <button
        type="button"
        className="group block w-full overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
        aria-label={`打开画板：${displayTitle}`}
        onClick={() => setOpen(true)}
      >
        <div className="relative aspect-[16/9] min-h-[280px] w-full bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.55)_1px,transparent_0)] bg-[length:28px_28px]">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt={displayTitle} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/70">
              <PenLine className="h-10 w-10" />
            </div>
          )}
        </div>
      </button>
      <WhiteboardFullscreenDialog
        whiteboardId={whiteboardId}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
