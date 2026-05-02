import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { useI18n } from './I18nProvider';
import type { SupportedLanguage } from './index';

export function useLanguage() {
  const { t } = useTranslation();
  const { changeLanguage, language: currentLanguage } = useI18n();

  const switchLanguage = useCallback(
    async (lang: SupportedLanguage) => {
      await changeLanguage(lang);
    },
    [changeLanguage],
  );

  return {
    t,
    switchLanguage,
    currentLanguage,
  };
}
