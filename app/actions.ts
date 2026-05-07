"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { flattenZodErrors, parseCardMemoFormData, parsePersonalExpressionFormData, parsePersonalExpressionUpdateFormData, parseQuestionNoteFormData, parseQuestionNoteUpdateFormData } from "@/lib/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getExpressionStore } from "@/lib/lesson-store";
import { createPersonalExpression, deletePersonalExpression, recordExpressionReview, updateExpressionMemo, updatePersonalExpression } from "@/lib/use-cases/expressions";
import { createQuestionNote, updateQuestionNote, updateQuestionStatus } from "@/lib/use-cases/questions";
import { passwordResetRedirectUrl } from "@/lib/site-url";
import { type ActionState, type QuestionNoteStatus } from "@/lib/types";

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
    await updateExpressionMemo(getExpressionStore(user), expressionId, parsed.data);
    revalidateAppPaths();
    revalidatePath(`/expressions/${expressionId}`);
    return { ok: true, message: "메모를 저장했습니다." };
  } catch (error) {
    return errorState(error);
  }
}

export async function createPersonalExpressionAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parsePersonalExpressionFormData(formData);
  if (!parsed.success) return { ok: false, fieldErrors: flattenZodErrors(parsed.error), message: "표현 내용을 확인해 주세요." };

  let expressionId: string;
  try {
    const user = await requireCurrentUser();
    expressionId = await createPersonalExpression(getExpressionStore(user), parsed.data);
    revalidateAppPaths();
  } catch (error) {
    return errorState(error);
  }

  redirect(`/expressions/${expressionId}`);
}

export async function updatePersonalExpressionAction(expressionId: string, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parsePersonalExpressionUpdateFormData(formData);
  if (!parsed.success) return { ok: false, fieldErrors: flattenZodErrors(parsed.error), message: "표현 내용을 확인해 주세요." };

  try {
    const user = await requireCurrentUser();
    await updatePersonalExpression(getExpressionStore(user), expressionId, parsed.data);
    revalidateAppPaths();
    revalidatePath(`/expressions/${expressionId}`);
  } catch (error) {
    return errorState(error);
  }

  redirect(`/expressions/${expressionId}`);
}

export async function deletePersonalExpressionAction(expressionId: string): Promise<void> {
  const user = await requireCurrentUser();
  const targetPath = await deletePersonalExpression(getExpressionStore(user), expressionId);
  revalidateAppPaths();
  revalidatePath(`/expressions/${expressionId}`);
  redirect(targetPath);
}

async function recordExpressionReviewForCurrentUser(expressionId: string, result: "known" | "unknown") {
  const user = await requireCurrentUser();
  await recordExpressionReview(getExpressionStore(user), expressionId, result);
  revalidateAppPaths();
  revalidatePath(`/expressions/${expressionId}`);
}

export async function recordExpressionReviewAction(expressionId: string, result: "known" | "unknown", returnTo = "/memorize") {
  await recordExpressionReviewForCurrentUser(expressionId, result);
  redirect(returnTo.startsWith("/") ? returnTo : "/memorize");
}

export async function recordExpressionReviewInPlaceAction(expressionId: string, result: "known" | "unknown") {
  await recordExpressionReviewForCurrentUser(expressionId, result);
  return { ok: true };
}

export async function createQuestionNoteAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseQuestionNoteFormData(formData);
  if (!parsed.success) return { ok: false, fieldErrors: flattenZodErrors(parsed.error), message: "질문 내용을 확인해 주세요." };

  try {
    const user = await requireCurrentUser();
    await createQuestionNote(getExpressionStore(user), parsed.data);
    revalidateAppPaths();
    return { ok: true, message: "질문거리를 추가했습니다." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateQuestionStatusAction(questionId: string, status: QuestionNoteStatus) {
  const user = await requireCurrentUser();
  await updateQuestionStatus(getExpressionStore(user), questionId, status);
  revalidateAppPaths();
}

export async function updateQuestionNoteAction(questionId: string, _previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseQuestionNoteUpdateFormData(formData);
  if (!parsed.success) return { ok: false, fieldErrors: flattenZodErrors(parsed.error), message: "질문 내용을 확인해 주세요." };

  try {
    const user = await requireCurrentUser();
    await updateQuestionNote(getExpressionStore(user), questionId, parsed.data);
    revalidateAppPaths();
    return { ok: true, message: "질문거리와 답변 메모를 저장했습니다." };
  } catch (error) {
    return errorState(error);
  }
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

export async function updatePasswordAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 6) return { ok: false, message: "새 비밀번호는 6자 이상이어야 합니다." };
  if (password !== confirmPassword) return { ok: false, message: "비밀번호 확인이 일치하지 않습니다." };

  try {
    const supabase = await createServerSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { ok: false, message: "재설정 링크가 만료되었거나 세션을 확인할 수 없습니다. 메일 링크를 다시 열어 주세요." };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, message: error.message };

    await supabase.auth.signOut();
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요." };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
