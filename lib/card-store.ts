import { randomUUID } from "node:crypto";

import { scheduleReviewQueue } from "@/lib/scheduling";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isE2EMemoryMode } from "@/lib/test-mode";
import type { CardExample, CardInput, DashboardStats, StudyCard, UserIdentity } from "@/lib/types";

type SupabaseCardRow = Omit<StudyCard, "examples"> & {
  card_examples?: CardExample[] | null;
};

export interface CardStore {
  listCards(filters?: { status?: StudyCard["status"] | "all" }): Promise<StudyCard[]>;
  getCard(id: string): Promise<StudyCard | null>;
  createCard(input: CardInput): Promise<StudyCard>;
  updateCard(id: string, input: CardInput): Promise<StudyCard>;
  deleteCard(id: string): Promise<void>;
  markReviewed(id: string, status: "known" | "confusing"): Promise<StudyCard>;
  getReviewQueue(options?: { confusingOnly?: boolean; limit?: number }): Promise<StudyCard[]>;
  getDashboardStats(): Promise<DashboardStats>;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSupabaseCard(row: SupabaseCardRow): StudyCard {
  return {
    ...row,
    examples: [...(row.card_examples ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  };
}

function requireCard<T>(card: T | null | undefined, message = "Card not found") {
  if (!card) throw new Error(message);
  return card;
}

class SupabaseCardStore implements CardStore {
  constructor(private readonly user: UserIdentity) {}

  private async supabase() {
    return createServerSupabaseClient();
  }

  async listCards(filters: { status?: StudyCard["status"] | "all" } = {}) {
    const supabase = await this.supabase();
    let query = supabase
      .from("study_cards")
      .select("*, card_examples(*)")
      .eq("owner_id", this.user.id)
      .order("created_at", { ascending: false });

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => normalizeSupabaseCard(row as SupabaseCardRow));
  }

  async getCard(id: string) {
    const supabase = await this.supabase();
    const { data, error } = await supabase
      .from("study_cards")
      .select("*, card_examples(*)")
      .eq("id", id)
      .eq("owner_id", this.user.id)
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeSupabaseCard(data as SupabaseCardRow) : null;
  }

  async createCard(input: CardInput) {
    const supabase = await this.supabase();
    const timestamp = nowIso();
    const { data: card, error: cardError } = await supabase
      .from("study_cards")
      .insert({
        owner_id: this.user.id,
        english_text: input.englishText,
        korean_meaning: input.koreanMeaning,
        grammar_note: input.grammarNote,
        updated_at: timestamp
      })
      .select("*")
      .single();

    if (cardError) throw cardError;

    const exampleRows = input.examples.map((exampleText, index) => ({
      card_id: card.id,
      example_text: exampleText,
      sort_order: index
    }));

    const { error: examplesError } = await supabase.from("card_examples").insert(exampleRows);
    if (examplesError) throw examplesError;

    return requireCard(await this.getCard(card.id));
  }

  async updateCard(id: string, input: CardInput) {
    const supabase = await this.supabase();
    const timestamp = nowIso();
    const { error: cardError } = await supabase
      .from("study_cards")
      .update({
        english_text: input.englishText,
        korean_meaning: input.koreanMeaning,
        grammar_note: input.grammarNote,
        updated_at: timestamp
      })
      .eq("id", id)
      .eq("owner_id", this.user.id);

    if (cardError) throw cardError;

    const { error: deleteError } = await supabase.from("card_examples").delete().eq("card_id", id);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("card_examples").insert(
      input.examples.map((exampleText, index) => ({
        card_id: id,
        example_text: exampleText,
        sort_order: index
      }))
    );
    if (insertError) throw insertError;

    return requireCard(await this.getCard(id));
  }

  async deleteCard(id: string) {
    const supabase = await this.supabase();
    const { error } = await supabase.from("study_cards").delete().eq("id", id).eq("owner_id", this.user.id);
    if (error) throw error;
  }

  async markReviewed(id: string, status: "known" | "confusing") {
    const existing = requireCard(await this.getCard(id));
    const supabase = await this.supabase();
    const timestamp = nowIso();
    const { error } = await supabase
      .from("study_cards")
      .update({
        status,
        last_reviewed_at: timestamp,
        review_count: existing.review_count + 1,
        updated_at: timestamp
      })
      .eq("id", id)
      .eq("owner_id", this.user.id);

    if (error) throw error;
    return requireCard(await this.getCard(id));
  }

  async getReviewQueue(options: { confusingOnly?: boolean; limit?: number } = {}) {
    const cards = await this.listCards({ status: options.confusingOnly ? "confusing" : "all" });
    return scheduleReviewQueue(cards, options.limit ?? 10);
  }

  async getDashboardStats() {
    const cards = await this.listCards();
    return calculateStats(cards);
  }
}

type MemoryState = { cards: StudyCard[] };

const globalMemory = globalThis as typeof globalThis & { __englishReviewMemoryStore?: MemoryState };

export function resetMemoryCardStoreForTests() {
  globalMemory.__englishReviewMemoryStore = { cards: [] };
}

function memoryState() {
  globalMemory.__englishReviewMemoryStore ??= { cards: [] };
  return globalMemory.__englishReviewMemoryStore;
}

export class MemoryCardStore implements CardStore {
  constructor(private readonly user: UserIdentity) {}

  async listCards(filters: { status?: StudyCard["status"] | "all" } = {}) {
    const cards = memoryState().cards.filter((card) => card.owner_id === this.user.id);
    const filtered = filters.status && filters.status !== "all" ? cards.filter((card) => card.status === filters.status) : cards;
    return [...filtered].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }

  async getCard(id: string) {
    return memoryState().cards.find((card) => card.id === id && card.owner_id === this.user.id) ?? null;
  }

  async createCard(input: CardInput) {
    const timestamp = nowIso();
    const cardId = randomUUID();
    const card: StudyCard = {
      id: cardId,
      owner_id: this.user.id,
      english_text: input.englishText,
      korean_meaning: input.koreanMeaning,
      grammar_note: input.grammarNote,
      status: "new",
      last_reviewed_at: null,
      review_count: 0,
      created_at: timestamp,
      updated_at: timestamp,
      examples: input.examples.map((exampleText, index) => ({
        id: randomUUID(),
        card_id: cardId,
        example_text: exampleText,
        sort_order: index,
        created_at: timestamp
      }))
    };

    memoryState().cards.unshift(card);
    return card;
  }

  async updateCard(id: string, input: CardInput) {
    const state = memoryState();
    const index = state.cards.findIndex((card) => card.id === id && card.owner_id === this.user.id);
    if (index === -1) throw new Error("Card not found");
    const existing = state.cards[index];
    const timestamp = nowIso();
    const updated: StudyCard = {
      ...existing,
      english_text: input.englishText,
      korean_meaning: input.koreanMeaning,
      grammar_note: input.grammarNote,
      updated_at: timestamp,
      examples: input.examples.map((exampleText, sortOrder) => ({
        id: randomUUID(),
        card_id: id,
        example_text: exampleText,
        sort_order: sortOrder,
        created_at: timestamp
      }))
    };
    state.cards[index] = updated;
    return updated;
  }

  async deleteCard(id: string) {
    const state = memoryState();
    state.cards = state.cards.filter((card) => !(card.id === id && card.owner_id === this.user.id));
  }

  async markReviewed(id: string, status: "known" | "confusing") {
    const state = memoryState();
    const index = state.cards.findIndex((card) => card.id === id && card.owner_id === this.user.id);
    if (index === -1) throw new Error("Card not found");
    const timestamp = nowIso();
    const updated: StudyCard = {
      ...state.cards[index],
      status,
      last_reviewed_at: timestamp,
      review_count: state.cards[index].review_count + 1,
      updated_at: timestamp
    };
    state.cards[index] = updated;
    return updated;
  }

  async getReviewQueue(options: { confusingOnly?: boolean; limit?: number } = {}) {
    const cards = await this.listCards({ status: options.confusingOnly ? "confusing" : "all" });
    return scheduleReviewQueue(cards, options.limit ?? 10);
  }

  async getDashboardStats() {
    const cards = await this.listCards();
    return calculateStats(cards);
  }
}

function calculateStats(cards: StudyCard[]): DashboardStats {
  return {
    total: cards.length,
    newCount: cards.filter((card) => card.status === "new").length,
    knownCount: cards.filter((card) => card.status === "known").length,
    confusingCount: cards.filter((card) => card.status === "confusing").length,
    dueCount: scheduleReviewQueue(cards, 10).length
  };
}

export function getCardStore(user: UserIdentity): CardStore {
  if (isE2EMemoryMode()) {
    return new MemoryCardStore(user);
  }

  return new SupabaseCardStore(user);
}
