import React, { useState, useEffect } from 'react';
import {
  Search,
  GraduationCap,
  FolderTree,
  BarChart3,
  Timer,
  Plus,
  Settings,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useDeckStore } from '../../stores/deckStore';
import { usePomodoroStore } from '../../stores/pomodoroStore';

export const CommandPalette: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setActiveTab, startStudyForDeck } = useAppStore();
  const { decks, openCreateCardModal, openCreateDeckModal } = useDeckStore();
  const { startTimer } = usePomodoroStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const actions = [
    {
      id: 'study-all',
      title: 'Start Full Daily Study Queue',
      category: 'Study',
      icon: <GraduationCap className="w-4 h-4 text-emerald-500" />,
      run: () => {
        startStudyForDeck(null);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'create-card',
      title: 'Create New Flashcard',
      category: 'Actions',
      icon: <Plus className="w-4 h-4 text-blue-500" />,
      run: () => {
        setCommandPaletteOpen(false);
        openCreateCardModal();
      },
    },
    {
      id: 'create-deck',
      title: 'Create New Deck',
      category: 'Actions',
      icon: <Plus className="w-4 h-4 text-purple-500" />,
      run: () => {
        setCommandPaletteOpen(false);
        openCreateDeckModal();
      },
    },
    {
      id: 'start-pomo',
      title: 'Start 25m Pomodoro Focus Session',
      category: 'Productivity',
      icon: <Timer className="w-4 h-4 text-red-500" />,
      run: () => {
        startTimer();
        setActiveTab('pomodoro');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'view-analytics',
      title: 'View Learning Analytics & Heatmap',
      category: 'Navigation',
      icon: <BarChart3 className="w-4 h-4 text-amber-500" />,
      run: () => {
        setActiveTab('analytics');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'view-settings',
      title: 'Open Application Settings',
      category: 'Navigation',
      icon: <Settings className="w-4 h-4 text-slate-500" />,
      run: () => {
        setActiveTab('settings');
        setCommandPaletteOpen(false);
      },
    },
  ];

  const filteredActions = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase())
  );

  const flatDecks: { id: string; name: string }[] = [];
  const collectDecks = (list: typeof decks) => {
    for (const d of list) {
      flatDecks.push({ id: d.id, name: d.name });
      if (d.children?.length) collectDecks(d.children);
    }
  };
  collectDecks(decks);

  const filteredDecks = flatDecks.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setCommandPaletteOpen(false)}
      />

      {/* Palette Box */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-slide-up">
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Type a command or deck name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="p-2 max-h-80 overflow-y-auto space-y-1">
          {filteredDecks.length > 0 && (
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Decks
            </div>
          )}
          {filteredDecks.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                startStudyForDeck(d.id);
                setCommandPaletteOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
            >
              <FolderTree className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{d.name}</span>
            </button>
          ))}

          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Commands
          </div>
          {filteredActions.map((action) => (
            <button
              key={action.id}
              onClick={action.run}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              {action.icon}
              <span className="flex-1 font-medium">{action.title}</span>
              <span className="text-xs text-slate-400">{action.category}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
