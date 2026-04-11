"use client";

import { useEffect, forwardRef, useImperativeHandle } from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { useTheme } from "next-themes";
import { useParams } from "next/navigation";
import * as locales from "@blocknote/core/locales";

import { useEdgeStore } from "@/src/lib/edgestore";
import { getBlockNoteLocale } from "@/src/lib/utils";

interface EditorProps {
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
}

export interface EditorRef {
  focus: () => void;
}

function Editor({ onChange, initialContent, editable = true }: EditorProps, ref: React.Ref<EditorRef>) {
  const { resolvedTheme } = useTheme();
  const { edgestore } = useEdgeStore();
  const params = useParams();
  const locale = (params.locale as string) || "en";

  const handleUpload = async (file: File) => {
    const response = await edgestore.publicFiles.upload({ file });

    return response.url;
  };

  const editor: BlockNoteEditor = useCreateBlockNote({
    initialContent: initialContent
      ? (JSON.parse(initialContent) as PartialBlock[])
      : undefined,
    uploadFile: handleUpload,
    dictionary: locales[getBlockNoteLocale(locale)] || locales.en,
  });

  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      onChange(JSON.stringify(editor.document, null, 2));
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [editor, onChange]);

  // 聚焦到编辑器的方法
  const focusEditor = () => {
    editor.focus();
  };

  // 将focus方法暴露给父组件
  useImperativeHandle(ref, () => ({
    focus: focusEditor
  }));

  return (
    <div>
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        editable={editable}
      />
    </div>
  );
}

export default forwardRef<EditorRef, EditorProps>(Editor);
