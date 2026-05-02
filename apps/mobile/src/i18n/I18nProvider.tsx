import { createContext, useContext, useEffect, useState } from 'react';
import i18n, { getDeviceLanguage, type SupportedLanguage } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = '@notion/language';

interface I18nContextType {
  isLoading: boolean;
  language: SupportedLanguage;
  changeLanguage: (lang: SupportedLanguage) => Promise<void>;
}

const I18nContext = createContext<I18nContextType>({
  isLoading: true,
  language: 'en',
  changeLanguage: async () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<SupportedLanguage>('en');

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLanguage) {
          await i18n.changeLanguage(savedLanguage);
          setLanguage(savedLanguage as SupportedLanguage);
        } else {
          const deviceLang = getDeviceLanguage();
          setLanguage(deviceLang);
        }
      } catch (error) {
        console.error('Failed to load language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  const changeLanguage = async (lang: SupportedLanguage) => {
    await i18n.changeLanguage(lang);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    setLanguage(lang);
  };

  return (
    <I18nContext.Provider value={{ isLoading, language, changeLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
