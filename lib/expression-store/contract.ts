import type {
  ApprovedExpressionDayResult,
  CardMemoInput,
  DashboardStats,
  ExpressionCard,
  ExpressionDay,
  ExpressionIngestionPayload,
  PersonalExpressionInput,
  PersonalExpressionUpdateInput,
  IngestionRun,
  QuestionNote,
  QuestionNoteInput,
  QuestionNoteStatus
} from "@/lib/types";

export interface ExpressionStore {
  listExpressionDays(): Promise<ExpressionDay[]>;
  getExpressionDay(id: string): Promise<ExpressionDay | null>;
  getExpression(id: string): Promise<ExpressionCard | null>;
  getMemorizationQueue(options?: { limit?: number }): Promise<ExpressionCard[]>;
  getDashboardStats(): Promise<DashboardStats>;
  getDashboardOverview(options?: { queueLimit?: number; recentDayLimit?: number }): Promise<{
    stats: DashboardStats;
    recentDays: ExpressionDay[];
    queue: ExpressionCard[];
  }>;
  recordReviewResult(id: string, result: "known" | "unknown"): Promise<ExpressionCard>;
  updateExpressionMemo(id: string, input: CardMemoInput): Promise<ExpressionCard>;
  createPersonalExpression(input: PersonalExpressionInput): Promise<ExpressionCard>;
  updatePersonalExpression(id: string, input: PersonalExpressionUpdateInput): Promise<ExpressionCard>;
  deletePersonalExpression(id: string): Promise<void>;
  listQuestionNotes(): Promise<QuestionNote[]>;
  createQuestionNote(input: QuestionNoteInput): Promise<QuestionNote>;
  updateQuestionNote(id: string, input: Partial<QuestionNoteInput> & { status?: QuestionNoteStatus }): Promise<QuestionNote>;
  createDraft(payload: ExpressionIngestionPayload): Promise<IngestionRun>;
  reviseDraft(id: string, payload: ExpressionIngestionPayload): Promise<IngestionRun>;
  approveDraft(id: string, approvalText: string): Promise<ApprovedExpressionDayResult>;
  getIngestionRun(id: string): Promise<IngestionRun | null>;
}
