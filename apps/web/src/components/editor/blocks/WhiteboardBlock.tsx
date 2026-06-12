"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { Shapes } from "lucide-react";
import { useTranslations } from "next-intl";

function DeprecatedWhiteboardBlock({
  title,
}: {
  title: string;
}) {
  const t = useTranslations("Whiteboard");
  const displayTitle = title || t("untitled");

  return (
    <div
      contentEditable={false}
      className="my-4 w-full rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground"
      aria-label={displayTitle}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
          <Shapes className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium text-foreground">{displayTitle}</div>
          <div>{t("disabledDescription")}</div>
        </div>
      </div>
    </div>
  );
}

export const WhiteboardBlock = createReactBlockSpec(
  {
    type: "whiteboard",
    propSchema: {
      ...defaultProps,
      whiteboardId: { default: "" },
      title: { default: "" },
      thumbnailUrl: { default: "" },
      engine: { default: "excalidraw", values: ["excalidraw"] },
    },
    content: "none",
  },
  {
    render: ({ block }) => (
      <DeprecatedWhiteboardBlock title={block.props.title} />
    ),
  },
);
