import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import vi from '../locales/vi.json';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

// Get saved language or default to Vietnamese
const savedLanguage = localStorage.getItem('el_language') || 'vi';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
      zh: { translation: zh },
    },
    lng: savedLanguage,
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Sync language change to localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('el_language', lng);
});

export default i18n;
