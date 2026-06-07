"use client";

import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

import { WhiteboardThumbnail } from "@/src/components/whiteboard/WhiteboardThumbnail";

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
      <WhiteboardThumbnail
        whiteboardId={block.props.whiteboardId}
        title={block.props.title}
      />
    ),
  },
);
