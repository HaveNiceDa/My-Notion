"use client";

import { useEffect } from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteViewRaw, useBlockNote } from "@blocknote/react";
import "@blocknote/core/style.css";
import { useTheme } from "next-themes";

import { useEdgeStore } from "@/lib/edgestore";

interface EditorProps {
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
}

function Editor({ onChange, initialContent, editable }: EditorProps) {
  const { resolvedTheme } = useTheme();
  const { edgestore } = useEdgeStore();

  const handleUpload = async (file: File) => {
    const response = await edgestore.publicFiles.upload({ file });

    return response.url;
  };

  const editor: BlockNoteEditor = useBlockNote({
    initialContent: initialContent
      ? (JSON.parse(initialContent) as PartialBlock[])
      : undefined,
    uploadFile: handleUpload,
  });

  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      onChange(JSON.stringify(editor.topLevelBlocks, null, 2));
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [editor, onChange]);

  return (
    <div>
      <BlockNoteViewRaw
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
      />
    </div>
  );
}

export default Editor;
