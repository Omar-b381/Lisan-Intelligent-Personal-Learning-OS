import { en } from './en';
import { ar } from './ar';

export type TranslationKey = keyof typeof en;
export type Language = 'en' | 'ar';

export const translations = { en, ar };

export function t(key: TranslationKey, lang: Language = 'en'): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}
