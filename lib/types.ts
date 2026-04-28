export const CARD_STATUSES = ["new", "known", "confusing"] as const;

export type CardStatus = (typeof CARD_STATUSES)[number];

export type UserIdentity = {
  id: string;
  email?: string | null;
};

export type CardExample = {
  id: string;
  card_id: string;
  example_text: string;
  sort_order: number;
  created_at: string;
};

export type StudyCard = {
  id: string;
  owner_id: string;
  english_text: string;
  korean_meaning: string;
  grammar_note: string;
  status: CardStatus;
  last_reviewed_at: string | null;
  review_count: number;
  created_at: string;
  updated_at: string;
  examples: CardExample[];
};

export type CardInput = {
  englishText: string;
  koreanMeaning: string;
  grammarNote: string;
  examples: string[];
};

export type DashboardStats = {
  total: number;
  newCount: number;
  knownCount: number;
  confusingCount: number;
  dueCount: number;
};

export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};
