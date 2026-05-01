export type CustomAIMenuItemDef = {
  key: string;
  title: string;
  subtext: string;
  prompt: string;
  icon: string;
  requiresSelection: boolean;
};

export const CUSTOM_AI_MENU_ITEMS: CustomAIMenuItemDef[] = [
  {
    key: "translate-to-en",
    title: "Translate to English",
    subtext: "将选中文本翻译为英文",
    prompt: "Translate the selected text to English",
    icon: "🇬🇧",
    requiresSelection: true,
  },
  {
    key: "translate-to-zh",
    title: "翻译为中文",
    subtext: "Translate selected text to Chinese",
    prompt: "Translate the selected text to Chinese (Simplified)",
    icon: "🇨🇳",
    requiresSelection: true,
  },
  {
    key: "improve-writing",
    title: "Improve writing",
    subtext: "改善写作风格和表达",
    prompt: "Improve the writing style and clarity of the selected text",
    icon: "✨",
    requiresSelection: true,
  },
  {
    key: "make-shorter",
    title: "Make shorter",
    subtext: "精简选中文本",
    prompt: "Make the selected text shorter and more concise while preserving the meaning",
    icon: "📝",
    requiresSelection: true,
  },
  {
    key: "make-longer",
    title: "Make longer",
    subtext: "扩写选中文本",
    prompt: "Expand the selected text with more detail and elaboration",
    icon: "📖",
    requiresSelection: true,
  },
  {
    key: "generate-outline",
    title: "Generate outline",
    subtext: "根据主题生成大纲",
    prompt: "Generate a detailed outline for the topic above",
    icon: "📋",
    requiresSelection: false,
  },
  {
    key: "continue-writing",
    title: "Continue writing",
    subtext: "继续往下写",
    prompt: "Continue writing from where the text above left off",
    icon: "✍️",
    requiresSelection: false,
  },
  {
    key: "summarize-above",
    title: "Summarize above",
    subtext: "总结上方内容",
    prompt: "Summarize the content above in a concise paragraph",
    icon: "📌",
    requiresSelection: false,
  },
];

export function getCustomItemsForContext(hasSelection: boolean): CustomAIMenuItemDef[] {
  return CUSTOM_AI_MENU_ITEMS.filter(
    (item) => item.requiresSelection === hasSelection,
  );
}
