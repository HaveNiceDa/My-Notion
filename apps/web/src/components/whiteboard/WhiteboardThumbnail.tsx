"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Shapes } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

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
  const t = useTranslations("Whiteboard");
  const { isSignedIn } = useUser();
  const preview = useQuery(
    api.whiteboards.getPreviewById,
    isSignedIn && whiteboardId ? { whiteboardId: whiteboardId as Id<"whiteboards"> } : "skip",
  );
  const displayTitle = preview?.title ?? (title || t("untitled"));
  const displayThumbnailUrl = preview?.thumbnailUrl ?? thumbnailUrl;

  return (
    <div
      contentEditable={false}
      className="my-4 w-full overflow-hidden rounded-xl border bg-white text-left shadow-sm opacity-80"
      data-whiteboard-id={whiteboardId}
      aria-label={displayTitle}
    >
      <div className="pointer-events-none">
        <div className="relative aspect-[16/9] min-h-[280px] w-full bg-white">
          {displayThumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayThumbnailUrl} alt={displayTitle} className="h-full w-full object-contain" />
          ) : (
            <EmptyWhiteboardPreview />
          )}
        </div>
      </div>
    </div>
  );
}
