import { vi, TranslationKeys } from './vi';
import { en } from './en';
import { zh } from './zh';

const locales: Record<string, Record<TranslationKeys, string>> = {
  vi,
  en,
  zh,
};

export const translate = (key: TranslationKeys, lang = 'vi'): string => {
  // Chuẩn hóa ngôn ngữ nhận vào (e.g. "en-US" -> "en")
  const language = lang.toLowerCase().startsWith('en')
    ? 'en'
    : lang.toLowerCase().startsWith('zh')
    ? 'zh'
    : 'vi';

  const dictionary = locales[language] || vi;
  return dictionary[key] || vi[key];
};

export { TranslationKeys };
export { vi, en, zh };
