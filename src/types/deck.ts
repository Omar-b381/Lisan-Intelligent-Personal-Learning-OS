export interface Deck {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface DeckStats {
  total_cards: number;
  new_cards: number;
  learning_cards: number;
  due_cards: number;
  suspended_cards: number;
  today_reviews: number;
  retention_rate: number;
  study_time_minutes: number;
}

export interface DeckWithStats extends Deck {
  stats: DeckStats;
  children: DeckWithStats[];
}

export interface CreateDeckDto {
  parent_id?: string | null;
  name: string;
  description?: string | null;
  color?: string;
  icon?: string;
  priority?: number;
}

export interface UpdateDeckDto {
  id: string;
  parent_id?: string | null;
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string;
  priority?: number;
}
