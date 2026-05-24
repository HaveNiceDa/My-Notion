"use client";

import { useEffect, forwardRef, useImperativeHandle } from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { useTheme } from "next-themes";
import { useParams } from "next/navigation";
import { AIExtension } from "@blocknote/xl-ai";
import "@blocknote/xl-ai/style.css";

import { useEdgeStore } from "@/src/lib/edgestore";
import { EditorFormattingToolbar } from "./editor/EditorFormattingToolbar";
import { EditorSlashMenu } from "./editor/EditorSlashMenu";
import { EditorAIMenuController } from "./editor/EditorAIMenuController";
import { useEditorAITransport } from "./editor/useEditorAITransport";
import { getBlockNoteDictionary, getAILocaleDict } from "./editor/editor-locale";

interface EditorProps {
  onChange: (value: string) => void;
  initialContent?: string;
  editable?: boolean;
}

export interface EditorRef {
  focus: () => void;
}

const Editor = forwardRef<EditorRef, EditorProps>(
  function Editor({ onChange, initialContent, editable = true }, ref) {
    const { resolvedTheme } = useTheme();
    const { edgestore } = useEdgeStore();
    const params = useParams();
    const locale = (params.locale as string) || "en";
    const transport = useEditorAITransport();

    const handleUpload = async (file: File) => {
      const response = await edgestore.publicFiles.upload({ file });
      return response.url;
    };

    const editor: BlockNoteEditor = useCreateBlockNote({
      initialContent: initialContent
        ? (JSON.parse(initialContent) as PartialBlock[])
        : undefined,
      uploadFile: handleUpload,
      dictionary: {
        ...getBlockNoteDictionary(locale),
        ai: getAILocaleDict(locale),
      },
      extensions: [
        AIExtension({
          transport,
        }),
      ],
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
          formattingToolbar={false}
          slashMenu={false}
        >
          <EditorAIMenuController editor={editor} locale={locale} />
          <EditorFormattingToolbar />
          <EditorSlashMenu editor={editor} />
        </BlockNoteView>
      </div>
    );
  },
);

export default Editor;
