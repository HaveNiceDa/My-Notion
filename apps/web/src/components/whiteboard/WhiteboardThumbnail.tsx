"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Shapes } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { WhiteboardFullscreenDialog } from "./WhiteboardFullscreenDialog";

interface WhiteboardThumbnailProps {
  whiteboardId: string;
  title: string;
  thumbnailUrl?: string;
}

function EmptyWhiteboardPreview() {
  const t = useTranslations("Whiteboard");
  return (
    <div className="flex h-full items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-muted-foreground/35 bg-muted/20">
          <Shapes className="h-8 w-8" />
        </div>
        <div className="text-center">
          <div className="text-sm font-medium text-foreground/80">{t("blankTitle")}</div>
          <div className="mt-1 text-xs text-muted-foreground">{t("blankDescription")}</div>
        </div>
      </div>
    </div>
  );
}

export function WhiteboardThumbnail({
  whiteboardId,
  title,
  thumbnailUrl,
}: WhiteboardThumbnailProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Whiteboard");
  const whiteboard = useQuery(api.whiteboards.getById, {
    whiteboardId: whiteboardId as Id<"whiteboards">,
  });
  const isLoading = whiteboard === undefined;
  const displayTitle = whiteboard?.title ?? (title || t("untitled"));
  const thumbnail = whiteboard?.thumbnailDataUrl ?? thumbnailUrl;

  return (
    <div contentEditable={false} className="my-4 w-full">
      <button
        type="button"
        className="group block w-full overflow-hidden rounded-xl border bg-white text-left shadow-sm transition duration-200 hover:border-primary/40 hover:shadow-md"
        aria-label={`${t("openLabel")}: ${displayTitle}`}
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
            <EmptyWhiteboardPreview />
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
