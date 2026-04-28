import { notFound } from "next/navigation";

import { CardForm } from "@/components/CardForm";
import { requireCurrentUser } from "@/lib/auth";
import { getCardStore } from "@/lib/card-store";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function EditCardPage({ params }: { params: Params }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const card = await getCardStore(user).getCard(id);
  if (!card) notFound();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">카드 수정</p>
        <h1 className="mt-2 text-3xl font-black text-ink">복습 내용 수정</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">변경사항을 저장하면 앱에서 관리하는 updated_at 시간이 갱신됩니다.</p>
      </div>
      <CardForm card={card} />
    </div>
  );
}
