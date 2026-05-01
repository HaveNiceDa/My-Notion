export type CustomAIMenuItemDef = {
  key: string;
  icon: string;
  requiresSelection: boolean;
  autoSubmit: boolean;
  title: Record<string, string>;
  subtext: Record<string, string>;
  prompt: string;
};

export const CUSTOM_AI_MENU_ITEMS: CustomAIMenuItemDef[] = [
  {
    key: "translate-to-en",
    icon: "🇬🇧",
    requiresSelection: true,
    autoSubmit: true,
    title: { en: "Translate to English", "zh-CN": "翻译为英文", "zh-TW": "翻譯為英文" },
    subtext: { en: "Translate selected text to English", "zh-CN": "将选中文本翻译为英文", "zh-TW": "將選中翻譯為英文" },
    prompt: "Translate the selected text to English",
  },
  {
    key: "translate-to-zh",
    icon: "�",
    requiresSelection: true,
    autoSubmit: true,
    title: { en: "Translate to Chinese", "zh-CN": "翻译为中文", "zh-TW": "翻譯為中文" },
    subtext: { en: "Translate selected text to Chinese", "zh-CN": "将选中文本翻译为中文", "zh-TW": "將選中翻譯為中文" },
    prompt: "Translate the selected text to Chinese (Simplified)",
  },
  {
    key: "improve-writing",
    icon: "✨",
    requiresSelection: true,
    autoSubmit: true,
    title: { en: "Improve writing", "zh-CN": "改善写作", "zh-TW": "改善寫作" },
    subtext: { en: "Improve writing style and clarity", "zh-CN": "改善写作风格和表达", "zh-TW": "改善寫作風格和表達" },
    prompt: "Improve the writing style and clarity of the selected text",
  },
  {
    key: "make-shorter",
    icon: "📝",
    requiresSelection: true,
    autoSubmit: true,
    title: { en: "Make shorter", "zh-CN": "精简文本", "zh-TW": "精簡文本" },
    subtext: { en: "Make text shorter and concise", "zh-CN": "精简选中文本", "zh-TW": "精簡選中文本" },
    prompt: "Make the selected text shorter and more concise while preserving the meaning",
  },
  {
    key: "make-longer",
    icon: "�",
    requiresSelection: true,
    autoSubmit: true,
    title: { en: "Make longer", "zh-CN": "扩写文本", "zh-TW": "擴寫文本" },
    subtext: { en: "Expand text with more detail", "zh-CN": "扩写选中文本", "zh-TW": "擴寫選中文本" },
    prompt: "Expand the selected text with more detail and elaboration",
  },
  {
    key: "generate-outline",
    icon: "�",
    requiresSelection: false,
    autoSubmit: true,
    title: { en: "Generate outline", "zh-CN": "生成大纲", "zh-TW": "生成大綱" },
    subtext: { en: "Generate a detailed outline", "zh-CN": "根据主题生成大纲", "zh-TW": "根據主題生成大綱" },
    prompt: "Generate a detailed outline for the topic above",
  },
  {
    key: "continue-writing",
    icon: "✍️",
    requiresSelection: false,
    autoSubmit: true,
    title: { en: "Continue writing", "zh-CN": "继续写作", "zh-TW": "繼續寫作" },
    subtext: { en: "Continue writing from here", "zh-CN": "继续往下写", "zh-TW": "繼續往下寫" },
    prompt: "Continue writing from where the text above left off",
  },
  {
    key: "summarize-above",
    icon: "📌",
    requiresSelection: false,
    autoSubmit: true,
    title: { en: "Summarize above", "zh-CN": "总结上方", "zh-TW": "總結上方" },
    subtext: { en: "Summarize content above", "zh-CN": "总结上方内容", "zh-TW": "總結上方內容" },
    prompt: "Summarize the content above in a concise paragraph",
  },
];

const SUPPORTED_LOCALES = ["en", "zh-CN", "zh-TW"];

export function resolveLocale(locale: string): string {
  if (SUPPORTED_LOCALES.includes(locale)) return locale;
  const langCode = locale.split("-")[0];
  if (langCode === "zh") return "zh-CN";
  return "en";
}

export function getCustomItemsForContext(
  hasSelection: boolean,
  locale: string = "en",
): Array<CustomAIMenuItemDef & { resolvedTitle: string; resolvedSubtext: string }> {
  const resolvedLocale = resolveLocale(locale);
  return CUSTOM_AI_MENU_ITEMS.filter(
    (item) => item.requiresSelection === hasSelection,
  ).map((item) => ({
    ...item,
    resolvedTitle: item.title[resolvedLocale] || item.title.en,
    resolvedSubtext: item.subtext[resolvedLocale] || item.subtext.en,
  }));
}
