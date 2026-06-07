import { Shapes } from "lucide-react";
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import type { Id } from "@/convex/_generated/dataModel";
import type { MyNotionBlockNoteEditor } from "../blocks/schema";

interface InsertWhiteboardItemOptions {
  editor: MyNotionBlockNoteEditor;
  documentId: Id<"documents">;
  copy: {
    title: string;
    aliases: string[];
    group: string;
    untitled: string;
  };
  createWhiteboard: (input: {
    title: string;
    documentId: Id<"documents">;
  }) => Promise<{ id: string; title: string; thumbnailUrl?: string; thumbnailDataUrl?: string }>;
}

export function createInsertWhiteboardItem({
  editor,
  documentId,
  copy,
  createWhiteboard,
}: InsertWhiteboardItemOptions) {
  return {
    title: copy.title,
    aliases: copy.aliases,
    group: copy.group,
    icon: <Shapes className="h-4 w-4" />,
    onItemClick: async () => {
      const whiteboard = await createWhiteboard({
        title: copy.untitled,
        documentId,
      });
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "whiteboard",
        props: {
          whiteboardId: whiteboard.id,
          title: whiteboard.title,
          thumbnailUrl: whiteboard.thumbnailUrl ?? whiteboard.thumbnailDataUrl ?? "",
          engine: "excalidraw",
        },
      });
    },
  };
}
