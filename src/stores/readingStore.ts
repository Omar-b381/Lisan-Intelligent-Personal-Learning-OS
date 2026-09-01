import { create } from 'zustand';
import { api } from '../services/api';
import { Book, Passage, WordLookupResult, AudioWithAlignment } from '../types/reading';
import { useAppStore } from './appStore';

interface ReadingState {
  // Library state
  books: Book[];
  isLoadingBooks: boolean;
  isImporting: boolean;
  importError: string | null;

  // Active Reader state
  activeBook: Book | null;
  currentPassage: Passage | null;
  isLoadingPassage: boolean;

  // Word Popover lookup state
  lookupWordText: string | null;
  lookupSentenceText: string | null;
  lookupResult: WordLookupResult | null;
  isLoadingLookup: boolean;
  isLookupOpen: boolean;
  isAddingCard: boolean;

  // Audio Playback & Real-time Alignment state
  audioData: AudioWithAlignment | null;
  isPlayingAudio: boolean;
  isLoadingAudio: boolean;
  currentWordIndex: number | null;
  playbackSpeed: number;

  // Reader UI settings
  fontSize: number;

  // Actions
  loadBooks: () => Promise<void>;
  importBook: (filePath: string, fileBytesBase64?: string) => Promise<Book | null>;
  openBook: (book: Book, passageIndex?: number) => Promise<void>;
  closeBook: () => void;
  goToPassage: (index: number) => Promise<void>;
  nextPassage: () => Promise<void>;
  prevPassage: () => Promise<void>;
  openLookup: (word: string, sentence: string) => Promise<void>;
  closeLookup: () => void;
  addWordToReview: () => Promise<void>;
  playPassageAudio: () => Promise<void>;
  pausePassageAudio: () => void;
  setAudioData: (data: AudioWithAlignment | null) => void;
  setCurrentWordIndex: (idx: number | null) => void;
  setPlaybackSpeed: (speed: number) => void;
  setFontSize: (size: number) => void;
  deleteBook: (bookId: number) => Promise<void>;
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  books: [],
  isLoadingBooks: false,
  isImporting: false,
  importError: null,

  activeBook: null,
  currentPassage: null,
  isLoadingPassage: false,

  lookupWordText: null,
  lookupSentenceText: null,
  lookupResult: null,
  isLoadingLookup: false,
  isLookupOpen: false,
  isAddingCard: false,

  audioData: null,
  isPlayingAudio: false,
  isLoadingAudio: false,
  currentWordIndex: null,
  playbackSpeed: 1.0,

  fontSize: 18,

  loadBooks: async () => {
    set({ isLoadingBooks: true });
    try {
      const books = await api.readingListBooks();
      set({ books: books || [], isLoadingBooks: false });
    } catch (err: any) {
      console.error('Failed to load books:', err);
      set({ isLoadingBooks: false });
    }
  },

  importBook: async (filePath, fileBytesBase64) => {
    set({ isImporting: true, importError: null });
    try {
      const newBook = await api.readingImportBook(filePath, fileBytesBase64);
      const books = await api.readingListBooks();
      set({ books: books || [], isImporting: false });
      return newBook;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      set({ isImporting: false, importError: errMsg });
      throw err;
    }
  },

  openBook: async (book, passageIndex) => {
    const pIndex = passageIndex !== undefined ? passageIndex : (book.last_passage_index || 0);
    set({
      activeBook: book,
      currentPassage: null,
      isLoadingPassage: true,
      audioData: null,
      isPlayingAudio: false,
      currentWordIndex: null,
    });

    try {
      const passage = await api.readingGetPassage(book.id, pIndex);
      set({ currentPassage: passage, isLoadingPassage: false });
    } catch (err: any) {
      console.error('Failed to open passage:', err);
      if (pIndex !== 0) {
        try {
          const fallbackPassage = await api.readingGetPassage(book.id, 0);
          set({ currentPassage: fallbackPassage, isLoadingPassage: false });
          return;
        } catch (_) {}
      }
      useAppStore.getState().showToast(err?.message || 'Failed to load passage');
      set({ isLoadingPassage: false });
    }
  },

  closeBook: () => {
    set({
      activeBook: null,
      currentPassage: null,
      audioData: null,
      isPlayingAudio: false,
      currentWordIndex: null,
      isLookupOpen: false,
    });
    get().loadBooks();
  },

  goToPassage: async (index) => {
    const { activeBook } = get();
    if (!activeBook) return;

    const targetIndex = Math.max(0, Math.min(index, activeBook.total_passages - 1));
    set({
      isLoadingPassage: true,
      audioData: null,
      isPlayingAudio: false,
      currentWordIndex: null,
    });

    try {
      const passage = await api.readingGetPassage(activeBook.id, targetIndex);
      set({
        currentPassage: passage,
        isLoadingPassage: false,
        activeBook: {
          ...activeBook,
          last_passage_index: targetIndex,
        },
      });

      // Auto save progress in background
      api.readingSaveProgress(activeBook.id, targetIndex).catch(() => {});
    } catch (err: any) {
      console.error('Failed to load passage:', err);
      set({ isLoadingPassage: false });
    }
  },

  nextPassage: async () => {
    const { activeBook, currentPassage, goToPassage } = get();
    if (!activeBook || !currentPassage) return;
    if (currentPassage.passage_index + 1 < activeBook.total_passages) {
      await goToPassage(currentPassage.passage_index + 1);
    }
  },

  prevPassage: async () => {
    const { activeBook, currentPassage, goToPassage } = get();
    if (!activeBook || !currentPassage) return;
    if (currentPassage.passage_index > 0) {
      await goToPassage(currentPassage.passage_index - 1);
    }
  },

  openLookup: async (word, sentence) => {
    set({
      lookupWordText: word,
      lookupSentenceText: sentence,
      lookupResult: null,
      isLoadingLookup: true,
      isLookupOpen: true,
    });

    try {
      const res = await api.readingLookupWord(word, sentence);
      set({ lookupResult: res, isLoadingLookup: false });
    } catch (err: any) {
      console.error('Lookup error:', err);
      set({
        lookupResult: {
          word,
          definition_en: null,
          translation_ar: null,
          example_sentence: null,
          source: 'none',
        },
        isLoadingLookup: false,
      });
    }
  },

  closeLookup: () => {
    set({ isLookupOpen: false, lookupResult: null });
  },

  addWordToReview: async () => {
    const { currentPassage, lookupWordText, lookupSentenceText, closeLookup } = get();
    const showToast = useAppStore.getState().showToast;
    const language = useAppStore.getState().language;

    if (!currentPassage || !lookupWordText || !lookupSentenceText) return;

    set({ isAddingCard: true });
    try {
      await api.readingAddWordToReview(
        currentPassage.id,
        lookupWordText,
        lookupSentenceText
      );

      const activeBookTitle = get().activeBook?.title;
      showToast(
        language === 'ar'
          ? activeBookTitle
            ? `تمت إضافة «${lookupWordText}» بنجاح إلى رزمة «${activeBookTitle}»!`
            : `تمت إضافة «${lookupWordText}» بنجاح إلى بطاقات المراجعة!`
          : activeBookTitle
          ? `Added "${lookupWordText}" to deck "${activeBookTitle}"!`
          : `Added "${lookupWordText}" to your review queue!`
      );
      closeLookup();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add flashcard');
    } finally {
      set({ isAddingCard: false });
    }
  },

  playPassageAudio: async () => {
    const { currentPassage, audioData } = get();
    if (!currentPassage) return;

    if (audioData) {
      set({ isPlayingAudio: true });
      return;
    }

    set({ isLoadingAudio: true });
    try {
      const audio = await api.readingSynthesizePassageAudio(currentPassage.id);
      set({
        audioData: audio,
        isLoadingAudio: false,
        isPlayingAudio: true,
      });
    } catch (err: any) {
      console.error('Failed to synthesize passage audio:', err);
      useAppStore.getState().showToast(err?.message || 'Audio synthesis failed');
      set({ isLoadingAudio: false, isPlayingAudio: false });
    }
  },

  pausePassageAudio: () => {
    set({ isPlayingAudio: false });
  },

  setAudioData: (data) => set({ audioData: data }),
  setCurrentWordIndex: (idx) => set({ currentWordIndex: idx }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setFontSize: (size) => set({ fontSize: size }),

  deleteBook: async (bookId) => {
    try {
      await api.readingDeleteBook(bookId);
      const books = await api.readingListBooks();
      set({ books: books || [] });
    } catch (err: any) {
      console.error('Failed to delete book:', err);
      throw err;
    }
  },
}));
