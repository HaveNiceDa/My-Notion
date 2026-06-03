import { Shapes } from "lucide-react";
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import type { Id } from "@/convex/_generated/dataModel";
import type { MyNotionBlockNoteEditor } from "../blocks/schema";

interface InsertWhiteboardItemOptions {
  editor: MyNotionBlockNoteEditor;
  documentId: Id<"documents">;
  locale: string;
  createWhiteboard: (input: {
    title: string;
    documentId: Id<"documents">;
  }) => Promise<{ id: string; title: string; thumbnailDataUrl?: string }>;
}

export function createInsertWhiteboardItem({
  editor,
  documentId,
  locale,
  createWhiteboard,
}: InsertWhiteboardItemOptions) {
  const isZh = locale.startsWith("zh");

  return {
    title: isZh ? "画板" : "Whiteboard",
    aliases: ["whiteboard", "board", "draw", "excalidraw", "绘图"],
    group: isZh ? "媒体" : "Media",
    icon: <Shapes className="h-4 w-4" />,
    onItemClick: async () => {
      const whiteboard = await createWhiteboard({
        title: isZh ? "未命名画板" : "Untitled whiteboard",
        documentId,
      });
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "whiteboard",
        props: {
          whiteboardId: whiteboard.id,
          title: whiteboard.title,
          thumbnailUrl: whiteboard.thumbnailDataUrl ?? "",
          engine: "excalidraw",
        },
      });
    },
  };
}
