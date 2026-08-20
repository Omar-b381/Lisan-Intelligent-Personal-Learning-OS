import { create } from 'zustand';
import { api } from '../services/api';
import { Card, CreateCardDto, UpdateCardDto } from '../types/card';
import { CreateDeckDto, DeckWithStats, UpdateDeckDto } from '../types/deck';

interface DeckState {
  decks: DeckWithStats[];
  selectedDeckId: string | null;
  isLoading: boolean;
  isCreateDeckModalOpen: boolean;
  isCreateCardModalOpen: boolean;
  editingCard: Card | null;
  editingDeck: DeckWithStats | null;

  fetchDecks: () => Promise<void>;
  setSelectedDeckId: (id: string | null) => void;
  openCreateDeckModal: (editingDeck?: DeckWithStats | null) => void;
  closeCreateDeckModal: () => void;
  openCreateCardModal: (editingCard?: Card | null) => void;
  closeCreateCardModal: () => void;
  createDeck: (dto: CreateDeckDto) => Promise<void>;
  updateDeck: (dto: UpdateDeckDto) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
  createCard: (dto: CreateCardDto) => Promise<void>;
  updateCard: (dto: UpdateCardDto) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
}

export const useDeckStore = create<DeckState>((set, get) => ({
  decks: [],
  selectedDeckId: null,
  isLoading: false,
  isCreateDeckModalOpen: false,
  isCreateCardModalOpen: false,
  editingCard: null,
  editingDeck: null,

  fetchDecks: async () => {
    set({ isLoading: true });
    try {
      const tree = await api.getDecksTree();
      set({ decks: tree, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch decks tree:', err);
      set({ isLoading: false });
    }
  },

  setSelectedDeckId: (selectedDeckId) => set({ selectedDeckId }),

  openCreateDeckModal: (editingDeck = null) =>
    set({ isCreateDeckModalOpen: true, editingDeck }),
  closeCreateDeckModal: () =>
    set({ isCreateDeckModalOpen: false, editingDeck: null }),

  openCreateCardModal: (editingCard = null) =>
    set({ isCreateCardModalOpen: true, editingCard }),
  closeCreateCardModal: () =>
    set({ isCreateCardModalOpen: false, editingCard: null }),

  createDeck: async (dto) => {
    await api.createDeck(dto);
    await get().fetchDecks();
    get().closeCreateDeckModal();
  },

  updateDeck: async (dto) => {
    await api.updateDeck(dto);
    await get().fetchDecks();
    get().closeCreateDeckModal();
  },

  deleteDeck: async (id) => {
    await api.deleteDeck(id);
    await get().fetchDecks();
  },

  createCard: async (dto) => {
    await api.createCard(dto);
    await get().fetchDecks();
    get().closeCreateCardModal();
  },

  updateCard: async (dto) => {
    await api.updateCard(dto);
    await get().fetchDecks();
    get().closeCreateCardModal();
  },

  deleteCard: async (id) => {
    await api.deleteCard(id);
    await get().fetchDecks();
  },
}));
