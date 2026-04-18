import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import en from "@notion-i18n/en.json";
import zhCN from "@notion-i18n/zh-CN.json";
import zhTW from "@notion-i18n/zh-TW.json";

export const resources = {
  en: { translation: en },
  "zh-CN": { translation: zhCN },
  "zh-TW": { translation: zhTW },
};

export const supportedLanguages = ["en", "zh-CN", "zh-TW"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const getDeviceLanguage = (): SupportedLanguage => {
  const locales = Localization.getLocales();
  if (locales && locales.length > 0) {
    const { languageCode, languageTag } = locales[0];
    if (supportedLanguages.includes(languageTag as SupportedLanguage)) {
      return languageTag as SupportedLanguage;
    }
    if (languageCode === "zh") {
      return "zh-TW";
    }
  }
  return "en";
};

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
