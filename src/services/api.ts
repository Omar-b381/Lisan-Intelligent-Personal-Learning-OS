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

// Safe check if running inside Tauri desktop environment
export const isTauri = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    Boolean(
      (window as any).__TAURI_INTERNALS__ ||
      (window as any).__TAURI__ ||
      (window as any).__TAURI_METADATA__
    )
  );
};

// Helper to safely execute Tauri commands
async function callTauri<T>(cmd: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  if (!isTauri()) {
    console.warn(`[Lisan Web Preview] Running outside Tauri desktop runtime. Command '${cmd}' using local fallback.`);
    if (fallback !== undefined) return fallback;
    return getFallbackData<T>(cmd, args);
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err: any) {
    console.error(`[IPC Error] ${cmd}:`, err);
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

// Fallback data when testing in browser outside desktop runtime
function getFallbackData<T>(cmd: string, args?: any): T {
  const now = new Date().toISOString();

  switch (cmd) {
    case 'get_decks_tree':
    case 'get_all_decks':
      return [
        {
          id: 'deck-1',
          name: 'Core English Vocabulary',
          description: 'Essential vocabulary with phonetic pronunciation and audio',
          color: '#10b981',
          icon: 'languages',
          parent_id: null,
          created_at: now,
          updated_at: now,
          card_count: 24,
          children: [],
          stats: {
            deck_id: 'deck-1',
            total_cards: 24,
            due_cards: 5,
            new_cards: 8,
            learning_cards: 4,
            review_cards: 12,
            retention_rate: 94.2,
            study_time_minutes: 45,
          },
        },
        {
          id: 'deck-2',
          name: 'Arabic Expressions & Rhetoric',
          description: 'البلاغة والتراكيب العربية الأصيلة',
          color: '#8b5cf6',
          icon: 'sparkles',
          parent_id: null,
          created_at: now,
          updated_at: now,
          card_count: 18,
          children: [],
          stats: {
            deck_id: 'deck-2',
            total_cards: 18,
            due_cards: 3,
            new_cards: 6,
            learning_cards: 2,
            review_cards: 10,
            retention_rate: 96.0,
            study_time_minutes: 32,
          },
        },
      ] as unknown as T;

    case 'get_daily_study_plan':
      return {
        due_cards_count: 8,
        new_cards_count: 14,
        target_minutes: 30,
        estimated_minutes: 22,
        xp_multiplier: 1.5,
      } as unknown as T;

    case 'get_overall_stats':
      return {
        total_cards_mastered: 42,
        total_reviews_done: 184,
        average_speed_seconds: 4.2,
        overall_retention_rate: 95.1,
        total_study_minutes: 128,
        current_streak_days: 7,
      } as unknown as T;

    case 'get_heatmap':
      return [] as unknown as T;

    case 'get_review_history_chart':
    case 'get_retention_trend_chart':
      return [] as unknown as T;

    case 'get_weak_cards':
    case 'get_all_tags':
      return [] as unknown as T;

    case 'get_app_settings':
      return {
        theme: 'system',
        language: 'ar',
        scheduler: {
          desired_retention: 0.9,
          maximum_interval_days: 36500,
          enable_fuzzing: true,
          easy_bonus: 1.3,
          hard_factor: 1.2,
          max_reviews_per_day: 200,
          max_new_cards_per_day: 20,
        },
        daily_study_target_minutes: 30,
        sound_effects: true,
        animations_enabled: true,
        auto_reveal_answer_secs: null,
      } as unknown as T;

    case 'get_study_queue':
      return [
        {
          card: {
            id: 'mock-card-1',
            deck_id: 'deck-1',
            card_type: 'basic',
            front: 'achieve',
            back: 'to successfully complete something with effort or skill\nيُنجز / يُحقق',
            notes: 'Pronunciation verified with ElevenLabs',
            state: 'new',
            stability: 0.0,
            difficulty: 0.0,
            reps: 0,
            lapses: 0,
            review_count: 0,
            last_review: null,
            next_review: null,
            interval_days: 0.0,
            ease_factor: 2.5,
            suspended: false,
            buried: false,
            tags: ['vocabulary', 'en-US'],
            created_at: new Date(),
            updated_at: new Date(),
          },
          deck_name: 'Core English Vocabulary',
          priority_score: 100.0,
        },
      ] as unknown as T;

    default:
      return null as unknown as T;
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
