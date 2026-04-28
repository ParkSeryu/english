"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { flattenZodErrors, parseItemNotesFormData, studyStatusSchema } from "@/lib/validation";
import { requireCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLessonStore } from "@/lib/lesson-store";
import type { ActionState, StudyStatus } from "@/lib/types";

function revalidateAppPaths() {
  revalidatePath("/");
  revalidatePath("/lessons");
  revalidatePath("/review");
  revalidatePath("/review/confusing");
}

function errorState(error: unknown): ActionState {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "문제가 발생했습니다. 다시 시도해 주세요."
  };
}

export async function updateItemNotesAction(itemId: string, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseItemNotesFormData(formData);
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodErrors(parsed.error), message: "메모 내용을 확인해 주세요." };
  }

  try {
    const user = await requireCurrentUser();
    await getLessonStore(user).updateItemNotes(itemId, parsed.data);
    revalidateAppPaths();
    revalidatePath(`/items/${itemId}`);
    return { ok: true, message: "메모를 저장했습니다." };
  } catch (error) {
    return errorState(error);
  }
}

export async function markItemStatusAction(itemId: string, status: StudyStatus, returnTo = "/review") {
  const parsedStatus = studyStatusSchema.safeParse(status);
  if (!parsedStatus.success || parsedStatus.data === "new") {
    throw new Error("복습 상태가 올바르지 않습니다.");
  }

  const user = await requireCurrentUser();
  await getLessonStore(user).markReviewed(itemId, parsedStatus.data);
  revalidateAppPaths();
  revalidatePath(`/items/${itemId}`);
  redirect(returnTo.startsWith("/") ? returnTo : "/review");
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
