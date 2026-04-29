"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { flattenZodErrors, parseCardMemoFormData, parseQuestionNoteFormData } from "@/lib/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getExpressionStore } from "@/lib/lesson-store";
import { passwordResetRedirectUrl } from "@/lib/site-url";
import type { ActionState } from "@/lib/types";

function revalidateAppPaths() {
  revalidatePath("/");
  revalidatePath("/expressions");
  revalidatePath("/memorize");
  revalidatePath("/questions");
}

function errorState(error: unknown): ActionState {
  return { ok: false, message: error instanceof Error ? error.message : "문제가 발생했습니다. 다시 시도해 주세요." };
}

export async function updateExpressionMemoAction(expressionId: string, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseCardMemoFormData(formData);
  if (!parsed.success) return { ok: false, fieldErrors: flattenZodErrors(parsed.error), message: "메모 내용을 확인해 주세요." };

  try {
    const user = await requireCurrentUser();
    await getExpressionStore(user).updateExpressionMemo(expressionId, parsed.data);
    revalidateAppPaths();
    revalidatePath(`/expressions/${expressionId}`);
    return { ok: true, message: "메모를 저장했습니다." };
  } catch (error) {
    return errorState(error);
  }
}

export async function recordExpressionReviewAction(expressionId: string, result: "known" | "unknown", returnTo = "/memorize") {
  if (result !== "known" && result !== "unknown") throw new Error("암기 결과가 올바르지 않습니다.");
  const user = await requireCurrentUser();
  await getExpressionStore(user).recordReviewResult(expressionId, result);
  revalidateAppPaths();
  revalidatePath(`/expressions/${expressionId}`);
  redirect(returnTo.startsWith("/") ? returnTo : "/memorize");
}

export async function createQuestionNoteAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseQuestionNoteFormData(formData);
  if (!parsed.success) return { ok: false, fieldErrors: flattenZodErrors(parsed.error), message: "질문 내용을 확인해 주세요." };

  try {
    const user = await requireCurrentUser();
    await getExpressionStore(user).createQuestionNote(parsed.data);
    revalidateAppPaths();
    return { ok: true, message: "질문거리를 추가했습니다." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateQuestionStatusAction(questionId: string, status: "open" | "asked") {
  const user = await requireCurrentUser();
  await getExpressionStore(user).updateQuestionNote(questionId, { status });
  revalidateAppPaths();
  redirect("/questions");
}

export async function signInAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { ok: false, message: "이메일과 비밀번호를 입력해 주세요." };

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
  if (!email || password.length < 6) return { ok: false, message: "이메일과 6자 이상의 비밀번호를 입력해 주세요." };

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, message: error.message };
  } catch (error) {
    return errorState(error);
  }

  return { ok: true, message: "계정을 만들었습니다. 이메일 확인이 켜져 있다면 메일을 확인한 뒤 로그인하세요." };
}


export async function resetPasswordAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "가입한 이메일을 입력해 주세요." };

  try {
    const headerStore = await headers();
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectUrl(headerStore)
    });
    if (error) return { ok: false, message: error.message };
  } catch (error) {
    return errorState(error);
  }

  return { ok: true, message: "비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해 주세요." };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
