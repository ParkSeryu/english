import Link from "next/link";
import { notFound } from "next/navigation";

import { PersonalExpressionEditForm } from "@/components/PersonalExpressionEditForm";
import { requireCurrentUser } from "@/lib/auth";
import { getExpressionStore } from "@/lib/lesson-store";

type Params = Promise<{ id: string }>;
export const dynamic = "force-dynamic";

export default async function EditExpressionPage({ params }: { params: Params }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const expression = await getExpressionStore(user).getExpression(id);
  if (!expression || !expression.can_delete) notFound();

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href={`/expressions/${expression.id}`} className="text-sm font-bold text-teal-700">← 표현 상세</Link>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">표현 수정</p>
        <h1 className="text-3xl font-black text-ink">내가 추가한 표현 수정</h1>
        <p className="text-sm leading-6 text-slate-600">표현 내용, 내 메모, 암기카드 포함 여부를 함께 수정합니다.</p>
      </div>
      <PersonalExpressionEditForm expression={expression} />
    </div>
  );
}
