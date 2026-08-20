export type CardState = 'new' | 'learning' | 'review' | 'relearning' | 'suspended' | 'buried';

export type CardType = 'basic' | 'cloze' | 'image' | 'audio';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface Card {
  id: string;
  deck_id: string;
  card_type: CardType;
  front: string;
  back: string;
  notes: string | null;
  state: CardState;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  review_count: number;
  last_review: string | null;
  next_review: string | null;
  interval_days: number;
  ease_factor: number;
  suspended: boolean;
  buried: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CardWithDeckInfo extends Card {
  deck_name: string;
  deck_color: string | null;
}

export interface NextReviewPreviews {
  again_interval_desc: string;
  hard_interval_desc: string;
  good_interval_desc: string;
  easy_interval_desc: string;
}

export interface CardStudyItem {
  card: Card;
  deck_name: string;
  previews: NextReviewPreviews;
  priority_score: number;
  current_retrievability: number;
}

export interface CreateCardDto {
  deck_id: string;
  card_type: CardType;
  front: string;
  back: string;
  notes?: string | null;
  tags: string[];
}

export interface UpdateCardDto {
  id: string;
  deck_id?: string;
  card_type?: CardType;
  front?: string;
  back?: string;
  notes?: string | null;
  tags?: string[];
  suspended?: boolean;
  buried?: boolean;
}
