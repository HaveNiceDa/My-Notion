import * as locales from "@blocknote/core/locales";
import * as aiLocales from "@blocknote/xl-ai/locales";

export function getBlockNoteDictionary(lang: string) {
  const langCode = lang.split("-")[0];
  if (langCode in locales) {
    return locales[langCode as keyof typeof locales];
  }
  return locales.en;
}

export function getAILocaleDict(locale: string) {
  switch (locale) {
    case "zh-CN":
      return aiLocales.zh;
    default:
      return aiLocales.en;
  }
}
