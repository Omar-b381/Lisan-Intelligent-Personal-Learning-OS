import React, { useEffect, useState } from 'react';
import {
  FolderTree,
  Plus,
  FileDown,
  FileUp,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  Sparkles,
  Edit3,
  Trash2,
} from 'lucide-react';
import { useDeckStore } from '../stores/deckStore';
import { useAppStore } from '../stores/appStore';
import { DeckWithStats } from '../types/deck';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ImportModal } from '../components/import_export/ImportModal';
import { api } from '../services/api';
import { t } from '../i18n';

export const Decks: React.FC = () => {
  const { language, startStudyForDeck, showToast } = useAppStore();
  const { decks, fetchDecks, openCreateDeckModal, openCreateCardModal, deleteDeck } = useDeckStore();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [expandedDecks, setExpandedDecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchDecks();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedDecks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportDeck = async (deckId: string, deckName: string) => {
    try {
      const json = await api.exportDeckJson(deckId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deckName.toLowerCase().replace(/\s+/g, '_')}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${deckName} to JSON!`);
    } catch (e: any) {
      alert(`Export failed: ${e?.message || e}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete deck "${name}" and all its cards?`)) {
      await deleteDeck(id);
      showToast('Deck deleted');
    }
  };

  const renderDeckNode = (node: DeckWithStats, depth: number = 0) => {
    const isExpanded = expandedDecks[node.id] ?? true;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="space-y-2">
        <div
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          {/* Deck Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {hasChildren && (
              <button
                onClick={() => toggleExpand(node.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}

            <div
              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: node.color }}
            />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {node.name}
                </h4>
                {node.stats.due_cards > 0 && (
                  <Badge variant="danger" size="sm">
                    {node.stats.due_cards} due
                  </Badge>
                )}
                {node.stats.new_cards > 0 && (
                  <Badge variant="info" size="sm">
                    {node.stats.new_cards} new
                  </Badge>
                )}
              </div>
              {node.description && (
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {node.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 font-medium">
            <span>{node.stats.total_cards} cards</span>
            <span>&bull;</span>
            <span>{node.stats.retention_rate}% retention</span>
            <span>&bull;</span>
            <span>{node.stats.study_time_minutes}m studied</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="primary"
              icon={<GraduationCap className="w-3.5 h-3.5" />}
              onClick={() => startStudyForDeck(node.id)}
            >
              Study
            </Button>

            <button
              onClick={() => openCreateCardModal()}
              title="Add card to deck"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleExportDeck(node.id, node.name)}
              title="Export deck to JSON"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FileDown className="w-4 h-4" />
            </button>

            <button
              onClick={() => openCreateDeckModal(node)}
              title="Edit deck"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleDelete(node.id, node.name)}
              title="Delete deck"
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Children / Subdecks */}
        {hasChildren && isExpanded && (
          <div className="space-y-2">
            {node.children.map((child) => renderDeckNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('allDecks', language)}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize knowledge hierarchically with nested subdecks and custom priority
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<FileUp className="w-4 h-4" />}
            onClick={() => setIsImportOpen(true)}
          >
            Import
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => openCreateDeckModal()}
          >
            {t('createDeck', language)}
          </Button>
        </div>
      </div>

      {/* Decks Tree */}
      <div className="space-y-3">
        {decks.map((deck) => renderDeckNode(deck, 0))}
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  );
};
