export const STUDY_STATUSES = ["new", "learning", "memorized", "confusing"] as const;

export type StudyStatus = (typeof STUDY_STATUSES)[number];

export const REVIEW_MODES = ["meaning-to-expression", "expression-to-meaning", "structure-to-pattern"] as const;

export type ReviewMode = (typeof REVIEW_MODES)[number];

export type UserIdentity = {
  id: string;
  email?: string | null;
};

export type StudyExample = {
  id: string;
  study_item_id: string;
  example_text: string;
  meaning_ko: string | null;
  source: "llm" | "user" | "class";
  sort_order: number;
  created_at: string;
};

export type LessonSummary = {
  id: string;
  title: string;
  source_note: string | null;
  lesson_date: string | null;
};

export type StudyItem = {
  id: string;
  lesson_id: string;
  owner_id: string;
  expression: string;
  meaning_ko: string;
  core_nuance: string | null;
  structure_note: string | null;
  grammar_note: string | null;
  user_memo: string | null;
  confusion_note: string | null;
  status: StudyStatus;
  last_reviewed_at: string | null;
  review_count: number;
  created_at: string;
  updated_at: string;
  examples: StudyExample[];
  lesson?: LessonSummary;
};

export type Lesson = {
  id: string;
  owner_id: string;
  title: string;
  raw_input: string;
  source_note: string | null;
  lesson_date: string | null;
  created_by: "llm" | "user";
  created_at: string;
  updated_at: string;
  items: StudyItem[];
};

export type IngestionStatus = "drafted" | "revised" | "approved" | "inserted" | "failed";

export type IngestionRun = {
  id: string;
  owner_id: string;
  raw_input: string;
  normalized_payload: LessonIngestionPayload;
  status: IngestionStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type LessonIngestionExampleInput = {
  example_text: string;
  meaning_ko?: string | null;
  source?: "llm" | "user" | "class";
};

export type LessonIngestionItemInput = {
  expression: string;
  meaning_ko: string;
  core_nuance?: string | null;
  structure_note?: string | null;
  grammar_note?: string | null;
  examples: LessonIngestionExampleInput[];
  confusion_note?: string | null;
  user_memo?: string | null;
};

export type LessonIngestionPayload = {
  lesson: {
    title: string;
    raw_input: string;
    source_note?: string | null;
    lesson_date?: string | null;
  };
  items: LessonIngestionItemInput[];
};

export type ItemNotesInput = {
  userMemo: string;
  confusionNote: string;
};

export type DashboardStats = {
  total: number;
  newCount: number;
  learningCount: number;
  memorizedCount: number;
  confusingCount: number;
  dueCount: number;
  lessonCount: number;
};

export type ApprovedLessonResult = {
  lesson: Lesson;
  itemUrls: string[];
};

export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};
