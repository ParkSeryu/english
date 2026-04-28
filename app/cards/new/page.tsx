import { CardForm } from "@/components/CardForm";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewCardPage() {
  await requireCurrentUser();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">새 카드</p>
        <h1 className="mt-2 text-3xl font-black text-ink">수업 내용 저장</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">필수 항목을 모두 채우고 예문을 하나 이상 입력하세요.</p>
      </div>
      <CardForm />
    </div>
  );
}
