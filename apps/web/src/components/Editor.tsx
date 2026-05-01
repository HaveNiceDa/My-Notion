"use client";

import { useEffect, forwardRef, useImperativeHandle, useMemo } from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import { useTheme } from "next-themes";
import { useParams } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import * as locales from "@blocknote/core/locales";
import { AIExtension } from "@blocknote/xl-ai";
import * as aiLocales from "@blocknote/xl-ai/locales";
import "@blocknote/xl-ai/style.css";
import { DefaultChatTransport } from "ai";

import { useEdgeStore } from "@/src/lib/edgestore";
import { useAIModelStore } from "@/src/lib/store/use-ai-model-store";
import { EditorFormattingToolbar } from "./editor/EditorFormattingToolbar";
import { EditorSlashMenu } from "./editor/EditorSlashMenu";
import { EditorAIMenuController } from "./editor/EditorAIMenuController";

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

function getAILocaleDict(locale: string) {
  switch (locale) {
    case "zh-CN":
      return aiLocales.zh;
    case "zh-TW":
      return aiLocales.zhTw;
    default:
      return aiLocales.en;
  }
}

const Editor = forwardRef<EditorRef, EditorProps>(
  function Editor({ onChange, initialContent, editable = true }, ref) {
    const { resolvedTheme } = useTheme();
    const { edgestore } = useEdgeStore();
    const params = useParams();
    const locale = (params.locale as string) || "en";
    const { isSignedIn, isLoaded } = useAuth();
    const { openSignIn } = useClerk();
    const { model } = useAIModelStore();

    const handleUpload = async (file: File) => {
      const response = await edgestore.publicFiles.upload({ file });

      return response.url;
    };

    const transport = useMemo(() => {
      const authFetch: typeof globalThis.fetch = async (input, init) => {
        if (isLoaded && !isSignedIn) {
          openSignIn({});
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
        return globalThis.fetch(input, init);
      };

      return new DefaultChatTransport({
        api: "/api/editor-ai/streamText",
        fetch: authFetch,
        body: {
          modelId: model,
        },
      });
    }, [model, isSignedIn, isLoaded, openSignIn]);

    const editor: BlockNoteEditor = useCreateBlockNote({
      initialContent: initialContent
        ? (JSON.parse(initialContent) as PartialBlock[])
        : undefined,
      uploadFile: handleUpload,
      dictionary: {
        ...locales[getBlockNoteLocale(locale)],
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
          <EditorAIMenuController />
          <EditorFormattingToolbar />
          <EditorSlashMenu editor={editor} />
        </BlockNoteView>
      </div>
    );
  },
);

export default Editor;
