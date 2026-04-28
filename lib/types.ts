export type UserIdentity = {
  id: string;
  email?: string | null;
};

export type ExpressionDaySummary = {
  id: string;
  title: string;
  source_note: string | null;
  day_date: string | null;
};

export type ExpressionExample = {
  id: string;
  expression_id: string;
  example_text: string;
  meaning_ko: string | null;
  source: "llm" | "user" | "class";
  sort_order: number;
  created_at: string;
};

export type ExpressionCard = {
  id: string;
  expression_day_id: string;
  owner_id: string;
  english: string;
  korean_prompt: string;
  nuance_note: string | null;
  structure_note: string | null;
  grammar_note: string | null;
  user_memo: string | null;
  source_order: number;
  known_count: number;
  unknown_count: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  examples: ExpressionExample[];
  day?: ExpressionDaySummary;
};

export type ExpressionDay = {
  id: string;
  owner_id: string;
  title: string;
  raw_input: string;
  source_note: string | null;
  day_date: string | null;
  created_by: "llm" | "user";
  created_at: string;
  updated_at: string;
  expressions: ExpressionCard[];
};

export type QuestionNoteStatus = "open" | "asked";

export type QuestionNote = {
  id: string;
  owner_id: string;
  question_text: string;
  status: QuestionNoteStatus;
  answer_note: string | null;
  created_at: string;
  updated_at: string;
};

export type IngestionStatus = "drafted" | "revised" | "approved" | "inserted" | "failed";

export type IngestionRun = {
  id: string;
  owner_id: string;
  raw_input: string;
  normalized_payload: ExpressionIngestionPayload;
  status: IngestionStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpressionIngestionExampleInput = {
  example_text: string;
  meaning_ko?: string | null;
  source?: "llm" | "user" | "class";
};

export type ExpressionIngestionCardInput = {
  english: string;
  korean_prompt: string;
  nuance_note?: string | null;
  structure_note?: string | null;
  grammar_note?: string | null;
  examples?: ExpressionIngestionExampleInput[];
  user_memo?: string | null;
};

export type ExpressionIngestionPayload = {
  expression_day: {
    title: string;
    raw_input: string;
    source_note?: string | null;
    day_date?: string | null;
  };
  expressions: ExpressionIngestionCardInput[];
};

export type CardMemoInput = {
  userMemo: string;
};

export type QuestionNoteInput = {
  questionText: string;
  answerNote?: string;
};

export type DashboardStats = {
  total: number;
  knownReviews: number;
  unknownReviews: number;
  unseenCount: number;
  dueCount: number;
  dayCount: number;
  questionCount: number;
  openQuestionCount: number;
};

export type ApprovedExpressionDayResult = {
  expressionDay: ExpressionDay;
  expressionUrls: string[];
};

export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

// Compatibility aliases for a small amount of legacy test/import surface.
export type LessonIngestionPayload = ExpressionIngestionPayload;
export type Lesson = ExpressionDay;
export type StudyItem = ExpressionCard;
export type StudyExample = ExpressionExample;
export type ItemNotesInput = CardMemoInput;
export type ApprovedLessonResult = ApprovedExpressionDayResult;
