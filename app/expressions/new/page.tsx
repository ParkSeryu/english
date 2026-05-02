import Link from "next/link";

import { PersonalExpressionForm } from "@/components/PersonalExpressionForm";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewExpressionPage() {
  await requireCurrentUser();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href="/expressions" className="text-sm font-bold text-teal-700">← 표현 목록</Link>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">내 표현</p>
        <h1 className="text-3xl font-black text-ink">표현 직접 추가</h1>
        <p className="text-sm leading-6 text-slate-600">여기서 추가한 표현은 내 계정에만 보입니다. 개발자가 LLM으로 넣은 표현만 전체 유저에게 공유됩니다.</p>
      </div>
      <PersonalExpressionForm />
    </div>
  );
}
