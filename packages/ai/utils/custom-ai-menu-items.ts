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
    title: { en: "Translate to English", "zh-CN": "翻译为英文" },
    subtext: { en: "Translate selected text to English", "zh-CN": "将选中文本翻译为英文" },
    prompt: "Translate the selected text to English",
  },
  {
    key: "translate-to-zh",
    icon: "�",
    requiresSelection: true,
    autoSubmit: true,
    title: { en: "Translate to Chinese", "zh-CN": "翻译为中文" },
    subtext: { en: "Translate selected text to Chinese", "zh-CN": "将选中文本翻译为中文" },
    prompt: "Translate the selected text to Chinese (Simplified)",
  },
  {
    key: "improve-writing",
    icon: "✨",
    requiresSelection: true,
    autoSubmit: true,
    title: { en: "Improve writing", "zh-CN": "改善写作" },
    subtext: { en: "Improve writing style and clarity", "zh-CN": "改善写作风格和表达" },
    prompt: "Improve the writing style and clarity of the selected text",
  },
  {
    key: "make-shorter",
    icon: "📝",
    requiresSelection: true,
    autoSubmit: true,
    title: { en: "Make shorter", "zh-CN": "精简文本" },
    subtext: { en: "Make text shorter and concise", "zh-CN": "精简选中文本" },
    prompt: "Make the selected text shorter and more concise while preserving the meaning",
  },
  {
    key: "make-longer",
    icon: "�",
    requiresSelection: true,
    autoSubmit: true,
    title: { en: "Make longer", "zh-CN": "扩写文本" },
    subtext: { en: "Expand text with more detail", "zh-CN": "扩写选中文本" },
    prompt: "Expand the selected text with more detail and elaboration",
  },
  {
    key: "generate-outline",
    icon: "�",
    requiresSelection: false,
    autoSubmit: true,
    title: { en: "Generate outline", "zh-CN": "生成大纲" },
    subtext: { en: "Generate a detailed outline", "zh-CN": "根据主题生成大纲" },
    prompt: "Generate a detailed outline for the topic above",
  },
  {
    key: "continue-writing",
    icon: "✍️",
    requiresSelection: false,
    autoSubmit: true,
    title: { en: "Continue writing", "zh-CN": "继续写作" },
    subtext: { en: "Continue writing from here", "zh-CN": "继续往下写" },
    prompt: "Continue writing from where the text above left off",
  },
  {
    key: "summarize-above",
    icon: "📌",
    requiresSelection: false,
    autoSubmit: true,
    title: { en: "Summarize above", "zh-CN": "总结上方" },
    subtext: { en: "Summarize content above", "zh-CN": "总结上方内容" },
    prompt: "Summarize the content above in a concise paragraph",
  },
];

const SUPPORTED_LOCALES = ["en", "zh-CN"];

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
