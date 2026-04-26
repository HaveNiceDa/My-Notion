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

interface EditorProps {
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
}

export interface EditorRef {
  focus: () => void;
}

function getBlockNoteLocale(lang: string): keyof typeof locales {
  const langCode = lang.split("-")[0];
  if (langCode in locales) {
    return langCode as keyof typeof locales;
  }
  return "en";
}

const Editor = forwardRef<EditorRef, EditorProps>(
  function Editor({ onChange, initialContent, editable = true }, ref) {
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
      dictionary: locales[getBlockNoteLocale(locale)],
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

    const focusEditor = () => {
      editor.focus();
    };

    useImperativeHandle(ref, () => ({
      focus: focusEditor,
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
  },
);

export default Editor;
