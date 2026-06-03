import { PenLine } from "lucide-react";
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import type { Id } from "@/convex/_generated/dataModel";
import type { MyNotionBlockNoteEditor } from "../blocks/schema";

interface InsertWhiteboardItemOptions {
  editor: MyNotionBlockNoteEditor;
  documentId: Id<"documents">;
  createWhiteboard: (input: {
    title: string;
    documentId: Id<"documents">;
  }) => Promise<{ id: string; title: string; thumbnailDataUrl?: string }>;
}

export function createInsertWhiteboardItem({
  editor,
  documentId,
  createWhiteboard,
}: InsertWhiteboardItemOptions) {
  return {
    title: "画板",
    aliases: ["whiteboard", "board", "draw", "excalidraw", "绘图"],
    group: "Media",
    icon: <PenLine className="h-4 w-4" />,
    onItemClick: async () => {
      const whiteboard = await createWhiteboard({
        title: "未命名画板",
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
