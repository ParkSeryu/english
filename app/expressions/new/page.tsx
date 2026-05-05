import Link from "next/link";

import { PersonalExpressionForm } from "@/components/PersonalExpressionForm";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ day?: string; topic?: string }>;

export default async function NewExpressionPage({ searchParams }: { searchParams: SearchParams }) {
  await requireCurrentUser();
  const params = await searchParams;
  const targetExpressionDayId = params.topic ?? params.day ?? null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href={targetExpressionDayId ? `/expressions?topic=${targetExpressionDayId}` : "/expressions"} className="text-sm font-bold text-teal-700">← 표현 목록</Link>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">표현 추가</p>
        <h1 className="text-3xl font-black text-ink">현재 학습 토픽에 표현 추가</h1>
        <p className="text-sm leading-6 text-slate-600">플로팅 버튼을 누른 학습 토픽 안에 내 계정에만 보이는 표현을 추가합니다.</p>
      </div>
      {targetExpressionDayId ? (
        <PersonalExpressionForm targetExpressionDayId={targetExpressionDayId} />
      ) : (
        <div className="rounded-[28px] border-2 border-dashed border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-900">
          표현 목록이나 상세 화면에서 플로팅 + 버튼을 눌러 현재 학습 토픽을 선택한 뒤 추가해 주세요.
        </div>
      )}
    </div>
  );
}
