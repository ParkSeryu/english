import { beforeEach, describe, expect, it } from "vitest";

import { MemoryCardStore, resetMemoryCardStoreForTests } from "@/lib/card-store";

const userA = { id: "00000000-0000-4000-8000-0000000000aa", email: "a@example.com" };
const userB = { id: "00000000-0000-4000-8000-0000000000bb", email: "b@example.com" };

const input = {
  englishText: "Could you elaborate on that?",
  koreanMeaning: "그 부분을 좀 더 자세히 설명해 주실 수 있나요?",
  grammarNote: "Could you + base verb makes a polite request.",
  examples: ["Could you elaborate on your schedule?"]
};

describe("MemoryCardStore integration behavior", () => {
  beforeEach(() => resetMemoryCardStoreForTests());

  it("creates, reads, updates, reviews, and deletes a card with examples", async () => {
    const store = new MemoryCardStore(userA);
    const created = await store.createCard(input);

    expect(created.owner_id).toBe(userA.id);
    expect(created.status).toBe("new");
    expect(created.examples).toHaveLength(1);

    const updated = await store.updateCard(created.id, { ...input, englishText: "Could you clarify that?", examples: ["Could you clarify your point?"] });
    expect(updated.english_text).toBe("Could you clarify that?");
    expect(Date.parse(updated.updated_at)).toBeGreaterThanOrEqual(Date.parse(created.updated_at));

    const confusing = await store.markReviewed(created.id, "confusing");
    expect(confusing.status).toBe("confusing");
    expect(confusing.review_count).toBe(1);
    expect(confusing.last_reviewed_at).toBeTruthy();

    const queue = await store.getReviewQueue();
    expect(queue[0].id).toBe(created.id);

    await store.deleteCard(created.id);
    expect(await store.listCards()).toEqual([]);
  });

  it("keeps cards owner-scoped", async () => {
    const card = await new MemoryCardStore(userA).createCard(input);
    const otherStore = new MemoryCardStore(userB);

    expect(await otherStore.getCard(card.id)).toBeNull();
    expect(await otherStore.listCards()).toEqual([]);
    await expect(otherStore.updateCard(card.id, input)).rejects.toThrow("Card not found");
  });
});
