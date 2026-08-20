import { create } from 'zustand';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { CardStudyItem, Rating } from '../types/card';
import { StudySession } from '../types/analytics';

interface StudyState {
  queue: CardStudyItem[];
  currentIndex: number;
  isRevealed: boolean;
  isLoading: boolean;
  isFocusMode: boolean;
  isSessionFinished: boolean;
  activeSession: StudySession | null;
  cardStartTime: number;
  sessionStats: {
    cardsStudied: number;
    correct: number;
    incorrect: number;
    xpGained: number;
  };

  loadQueue: (deckId?: string | null) => Promise<void>;
  revealAnswer: () => void;
  submitRating: (rating: Rating) => Promise<void>;
  toggleFocusMode: () => void;
  resetSession: () => void;
}

export const useStudyStore = create<StudyState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isRevealed: false,
  isLoading: false,
  isFocusMode: false,
  isSessionFinished: false,
  activeSession: null,
  cardStartTime: Date.now(),
  sessionStats: {
    cardsStudied: 0,
    correct: 0,
    incorrect: 0,
    xpGained: 0,
  },

  loadQueue: async (deckId) => {
    set({ isLoading: true, isSessionFinished: false, currentIndex: 0, isRevealed: false });
    try {
      const items = await api.getStudyQueue(deckId || undefined);
      const session = await api.startStudySession(deckId || undefined);
      set({
        queue: items,
        activeSession: session,
        cardStartTime: Date.now(),
        isLoading: false,
        sessionStats: { cardsStudied: 0, correct: 0, incorrect: 0, xpGained: 0 },
      });
    } catch (err) {
      console.error('Failed to load study queue:', err);
      set({ isLoading: false });
    }
  },

  revealAnswer: () => {
    set({ isRevealed: true });
  },

  submitRating: async (rating: Rating) => {
    const { queue, currentIndex, activeSession, cardStartTime, sessionStats } = get();
    const currentItem = queue[currentIndex];
    if (!currentItem) return;

    const responseTimeMs = Math.max(500, Date.now() - cardStartTime);

    try {
      const result = await api.submitReview({
        card_id: currentItem.card.id,
        rating,
        response_time_ms: responseTimeMs,
        session_id: activeSession?.id || null,
      });

      const isCorrect = rating !== 'again';
      const updatedStats = {
        cardsStudied: sessionStats.cardsStudied + 1,
        correct: sessionStats.correct + (isCorrect ? 1 : 0),
        incorrect: sessionStats.incorrect + (isCorrect ? 0 : 1),
        xpGained: sessionStats.xpGained + result.xp_earned,
      };

      const nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        // Completed session!
        if (activeSession) {
          await api.endStudySession(activeSession.id);
        }

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });

        set({
          isSessionFinished: true,
          sessionStats: updatedStats,
          isRevealed: false,
        });
      } else {
        set({
          currentIndex: nextIndex,
          isRevealed: false,
          cardStartTime: Date.now(),
          sessionStats: updatedStats,
        });
      }
    } catch (err) {
      console.error('Failed to submit review:', err);
    }
  },

  toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),

  resetSession: () =>
    set({
      queue: [],
      currentIndex: 0,
      isRevealed: false,
      isSessionFinished: false,
      activeSession: null,
      sessionStats: { cardsStudied: 0, correct: 0, incorrect: 0, xpGained: 0 },
    }),
}));
