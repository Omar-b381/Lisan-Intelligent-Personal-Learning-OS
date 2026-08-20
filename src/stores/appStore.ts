import { create } from 'zustand';
import { Language } from '../i18n';

export type NavTab = 'dashboard' | 'study' | 'decks' | 'browser' | 'analytics' | 'pomodoro' | 'settings';

interface AppState {
  activeTab: NavTab;
  theme: 'system' | 'dark' | 'light';
  language: Language;
  isCommandPaletteOpen: boolean;
  activeDeckIdForStudy: string | null;
  toastMessage: string | null;

  setActiveTab: (tab: NavTab) => void;
  setTheme: (theme: 'system' | 'dark' | 'light') => void;
  setLanguage: (lang: Language) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  startStudyForDeck: (deckId: string | null) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  theme: 'system',
  language: 'en',
  isCommandPaletteOpen: false,
  activeDeckIdForStudy: null,
  toastMessage: null,

  setActiveTab: (activeTab) => set({ activeTab }),
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
  },
  setLanguage: (language) => {
    set({ language });
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  },
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  startStudyForDeck: (deckId) =>
    set({ activeDeckIdForStudy: deckId, activeTab: 'study' }),
  showToast: (toastMessage) => {
    set({ toastMessage });
    setTimeout(() => set({ toastMessage: null }), 3500);
  },
  clearToast: () => set({ toastMessage: null }),
}));

function applyTheme(theme: 'system' | 'dark' | 'light') {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
