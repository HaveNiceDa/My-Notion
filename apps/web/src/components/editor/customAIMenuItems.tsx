"use client";

import type { BlockNoteEditor } from "@blocknote/core";
import type { AIMenuSuggestionItem } from "@blocknote/xl-ai";
import { getDefaultAIMenuItems } from "@blocknote/xl-ai";

function createAIMenuItem(
  key: string,
  title: string,
  subtext: string,
  prompt: string,
  icon?: string,
): AIMenuSuggestionItem {
  return {
    key,
    title,
    subtext,
    onItemClick: (setPrompt) => setPrompt(prompt),
    icon: icon ? <span>{icon}</span> : undefined,
  } as AIMenuSuggestionItem;
}

export function getCustomAIMenuItems(
  editor: BlockNoteEditor<any, any, any>,
  aiResponseStatus:
    | "user-input"
    | "thinking"
    | "ai-writing"
    | "error"
    | "user-reviewing"
    | "closed",
): AIMenuSuggestionItem[] {
  if (aiResponseStatus !== "user-input") {
    return getDefaultAIMenuItems(editor, aiResponseStatus);
  }

  const hasSelection = !!editor.getSelection();

  const selectionOnlyItems: AIMenuSuggestionItem[] = [
    createAIMenuItem(
      "translate-to-en",
      "Translate to English",
      "将选中文本翻译为英文",
      "Translate the selected text to English",
      "🇬🇧",
    ),
    createAIMenuItem(
      "translate-to-zh",
      "翻译为中文",
      "Translate selected text to Chinese",
      "Translate the selected text to Chinese (Simplified)",
      "🇨🇳",
    ),
    createAIMenuItem(
      "improve-writing",
      "Improve writing",
      "改善写作风格和表达",
      "Improve the writing style and clarity of the selected text",
      "✨",
    ),
    createAIMenuItem(
      "make-shorter",
      "Make shorter",
      "精简选中文本",
      "Make the selected text shorter and more concise while preserving the meaning",
      "📝",
    ),
    createAIMenuItem(
      "make-longer",
      "Make longer",
      "扩写选中文本",
      "Expand the selected text with more detail and elaboration",
      "📖",
    ),
  ];

  const cursorOnlyItems: AIMenuSuggestionItem[] = [
    createAIMenuItem(
      "generate-outline",
      "Generate outline",
      "根据主题生成大纲",
      "Generate a detailed outline for the topic above",
      "📋",
    ),
    createAIMenuItem(
      "continue-writing",
      "Continue writing",
      "继续往下写",
      "Continue writing from where the text above left off",
      "✍️",
    ),
    createAIMenuItem(
      "summarize-above",
      "Summarize above",
      "总结上方内容",
      "Summarize the content above in a concise paragraph",
      "📌",
    ),
  ];

  return [
    ...getDefaultAIMenuItems(editor, aiResponseStatus),
    ...(hasSelection ? selectionOnlyItems : cursorOnlyItems),
  ];
}
