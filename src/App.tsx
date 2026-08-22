import React, { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { usePomodoroStore } from './stores/pomodoroStore';
import { useDeckStore } from './stores/deckStore';
import { useStudyStore } from './stores/studyStore';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CommandPalette } from './components/layout/CommandPalette';
import { CardEditorModal } from './components/editor/CardEditorModal';
import { DeckModal } from './components/editor/DeckModal';

import { Dashboard } from './pages/Dashboard';
import { Study } from './pages/Study';
import { Decks } from './pages/Decks';
import { Browser } from './pages/Browser';
import { Analytics } from './pages/Analytics';
import { PomodoroPage } from './pages/PomodoroPage';
import { Settings } from './pages/Settings';
import { Practice } from './pages/Practice';

export const App: React.FC = () => {
  const { activeTab, theme, language, toastMessage, clearToast } = useAppStore();
  const { init: initPomodoro } = usePomodoroStore();
  const { fetchDecks } = useDeckStore();
  const { isFocusMode } = useStudyStore();

  useEffect(() => {
    initPomodoro();
    fetchDecks();
  }, []);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'study':
        return <Study />;
      case 'practice':
        return <Practice />;
      case 'decks':
        return <Decks />;
      case 'browser':
        return <Browser />;
      case 'analytics':
        return <Analytics />;
      case 'pomodoro':
        return <PomodoroPage />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div
      className={`h-screen w-screen flex bg-lisan-bg-light dark:bg-lisan-bg-dark text-slate-800 dark:text-slate-100 antialiased overflow-hidden ${
        language === 'ar' ? 'font-arabic' : 'font-sans'
      }`}
    >
      {/* Sidebar - hidden in Focus Mode */}
      {!isFocusMode && <Sidebar />}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {!isFocusMode && <Header />}

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto h-full">{renderActiveView()}</div>
        </main>
      </div>

      {/* Global Modals & Dialogs */}
      <CommandPalette />
      <CardEditorModal />
      <DeckModal />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div
          onClick={clearToast}
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-2xl animate-slide-up flex items-center gap-2 cursor-pointer"
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
