import { invoke } from '@tauri-apps/api/core';
import {
  Card,
  CardStudyItem,
  CardWithDeckInfo,
  CreateCardDto,
  UpdateCardDto,
} from '../types/card';
import {
  CreateDeckDto,
  Deck,
  DeckWithStats,
  UpdateDeckDto,
} from '../types/deck';
import {
  PomodoroConfig,
  PomodoroMode,
  PomodoroSession,
  PomodoroSessionSummary,
} from '../types/pomodoro';
import { ReviewResult, SubmitReviewDto } from '../types/review';
import {
  ChartDataPoint,
  DailyStudyPlan,
  HeatmapDay,
  OverallStats,
  StudySession,
  TagStats,
  WeakCardInfo,
} from '../types/analytics';
import {
  AppSettings,
  BackupFileInfo,
  ImportPreview,
} from '../types/settings';

// Helper to safely execute Tauri commands
async function callTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err: any) {
    console.error(`[IPC Error] ${cmd}:`, err);
    throw err;
  }
}

export const api = {
  // Decks
  getDecksTree: () => callTauri<DeckWithStats[]>('get_decks_tree'),
  getAllDecks: () => callTauri<Deck[]>('get_all_decks'),
  getDeckById: (id: string) => callTauri<Deck>('get_deck_by_id', { id }),
  createDeck: (dto: CreateDeckDto) => callTauri<Deck>('create_deck', { dto }),
  updateDeck: (dto: UpdateDeckDto) => callTauri<Deck>('update_deck', { dto }),
  deleteDeck: (id: string) => callTauri<void>('delete_deck', { id }),

  // Cards
  getCard: (id: string) => callTauri<Card>('get_card', { id }),
  createCard: (dto: CreateCardDto) => callTauri<Card>('create_card', { dto }),
  updateCard: (dto: UpdateCardDto) => callTauri<Card>('update_card', { dto }),
  deleteCard: (id: string) => callTauri<void>('delete_card', { id }),
  toggleSuspendCard: (id: string) => callTauri<boolean>('toggle_suspend_card', { id }),
  searchCards: (
    query: string,
    deckId?: string,
    tag?: string,
    cardState?: string,
    limit?: number,
    offset?: number
  ) =>
    callTauri<CardWithDeckInfo[]>('search_cards', {
      query,
      deckId: deckId || null,
      tag: tag || null,
      cardState: cardState || null,
      limit: limit || 50,
      offset: offset || 0,
    }),
  getWeakCards: (limit?: number) => callTauri<WeakCardInfo[]>('get_weak_cards', { limit }),

  // Study & Reviews
  getStudyQueue: (deckId?: string, limit?: number) =>
    callTauri<CardStudyItem[]>('get_study_queue', { deckId: deckId || null, limit: limit || 50 }),
  submitReview: (dto: SubmitReviewDto) => callTauri<ReviewResult>('submit_review', { dto }),
  startStudySession: (deckId?: string, pomodoroId?: string) =>
    callTauri<StudySession>('start_study_session', {
      deckId: deckId || null,
      pomodoroId: pomodoroId || null,
    }),
  endStudySession: (sessionId: string) =>
    callTauri<StudySession>('end_study_session', { sessionId }),
  getDailyStudyPlan: () => callTauri<DailyStudyPlan>('get_daily_study_plan'),

  // Pomodoro
  startPomodoro: (mode: PomodoroMode, targetDurationSecs: number) =>
    callTauri<PomodoroSession>('start_pomodoro', { mode, targetDurationSecs }),
  completePomodoro: (id: string, actualDurationSecs: number) =>
    callTauri<PomodoroSessionSummary>('complete_pomodoro', { id, actualDurationSecs }),
  getPomodoroConfig: () => callTauri<PomodoroConfig>('get_pomodoro_config'),
  savePomodoroConfig: (config: PomodoroConfig) =>
    callTauri<void>('save_pomodoro_config', { config }),

  // Analytics
  getOverallStats: () => callTauri<OverallStats>('get_overall_stats'),
  getHeatmap: () => callTauri<HeatmapDay[]>('get_heatmap'),
  getReviewHistoryChart: (days?: number) =>
    callTauri<ChartDataPoint[]>('get_review_history_chart', { days }),
  getRetentionTrendChart: (days?: number) =>
    callTauri<ChartDataPoint[]>('get_retention_trend_chart', { days }),

  // Tags
  getAllTags: () => callTauri<TagStats[]>('get_all_tags'),
  renameTag: (id: string, newName: string) => callTauri<void>('rename_tag', { id, newName }),
  deleteTag: (id: string) => callTauri<void>('delete_tag', { id }),

  // Media
  uploadMedia: (originalName: string, dataBase64: string, mimeType: string) =>
    callTauri<any>('upload_media', { originalName, dataBase64, mimeType }),
  getMediaBase64: (filename: string) => callTauri<string>('get_media_base64', { filename }),

  // Import / Export / Backup
  previewCsv: (content: string, delimiter?: string) =>
    callTauri<ImportPreview>('preview_csv', { content, delimiter: delimiter || ',' }),
  importCsv: (deckId: string, content: string, delimiter?: string) =>
    callTauri<number>('import_csv', { deckId, content, delimiter: delimiter || ',' }),
  exportDeckJson: (deckId: string) => callTauri<string>('export_deck_json', { deckId }),
  importJson: (jsonContent: string, targetDeckId?: string) =>
    callTauri<number>('import_json', { jsonContent, targetDeckId: targetDeckId || null }),
  createBackup: () => callTauri<BackupFileInfo>('create_backup'),
  listBackups: () => callTauri<BackupFileInfo[]>('list_backups'),

  // Settings
  getAppSettings: () => callTauri<AppSettings>('get_app_settings'),
  saveAppSettings: (settings: AppSettings) => callTauri<void>('save_app_settings', { settings }),
};
