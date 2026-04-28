"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { flattenZodErrors, parseCardFormData } from "@/lib/validation";
import { requireCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCardStore } from "@/lib/card-store";
import type { ActionState } from "@/lib/types";

function revalidateAppPaths() {
  revalidatePath("/");
  revalidatePath("/cards");
  revalidatePath("/review");
  revalidatePath("/review/confusing");
}

function errorState(error: unknown): ActionState {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "문제가 발생했습니다. 다시 시도해 주세요."
  };
}

export async function createCardAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseCardFormData(formData);
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodErrors(parsed.error), message: "필수 항목을 확인해 주세요." };
  }

  try {
    const user = await requireCurrentUser();
    await getCardStore(user).createCard(parsed.data);
    revalidateAppPaths();
  } catch (error) {
    return errorState(error);
  }

  redirect("/cards");
}

export async function updateCardAction(cardId: string, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseCardFormData(formData);
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodErrors(parsed.error), message: "필수 항목을 확인해 주세요." };
  }

  try {
    const user = await requireCurrentUser();
    await getCardStore(user).updateCard(cardId, parsed.data);
    revalidateAppPaths();
  } catch (error) {
    return errorState(error);
  }

  redirect("/cards");
}

export async function deleteCardAction(cardId: string) {
  const user = await requireCurrentUser();
  await getCardStore(user).deleteCard(cardId);
  revalidateAppPaths();
  redirect("/cards");
}

export async function markKnownAction(cardId: string) {
  const user = await requireCurrentUser();
  await getCardStore(user).markReviewed(cardId, "known");
  revalidateAppPaths();
  redirect("/review");
}

export async function markConfusingAction(cardId: string) {
  const user = await requireCurrentUser();
  await getCardStore(user).markReviewed(cardId, "confusing");
  revalidateAppPaths();
  redirect("/review");
}

export async function markKnownFromConfusingAction(cardId: string) {
  const user = await requireCurrentUser();
  await getCardStore(user).markReviewed(cardId, "known");
  revalidateAppPaths();
  redirect("/review/confusing");
}

export async function signInAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "이메일과 비밀번호를 입력해 주세요." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUpAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 6) {
    return { ok: false, message: "이메일과 6자 이상의 비밀번호를 입력해 주세요." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, message: error.message };
  } catch (error) {
    return errorState(error);
  }

  return { ok: true, message: "계정을 만들었습니다. 이메일 확인이 켜져 있다면 메일을 확인한 뒤 로그인하세요." };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
