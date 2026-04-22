import * as locales from "@blocknote/core/locales";

export function getBlockNoteLocale(lang: string) {
  const langCode = lang.split("-")[0];

  if (langCode in locales) {
    return langCode as keyof typeof locales;
  }

  return "en" as keyof typeof locales;
}
