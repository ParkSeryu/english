import Link from "next/link";
import { notFound } from "next/navigation";

import { ExpressionMemoForm } from "@/components/ExpressionMemoForm";
import { requireCurrentUser } from "@/lib/auth";
import { getExpressionStore } from "@/lib/lesson-store";

type Params = Promise<{ id: string }>;
export const dynamic = "force-dynamic";

export default async function ExpressionDetailPage({ params }: { params: Params }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const expression = await getExpressionStore(user).getExpression(id);
  if (!expression) notFound();

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-500">
          <span>틀림 {expression.unknown_count}회 · 외움 {expression.known_count}회</span>
          {expression.day ? <Link href={`/expressions?topic=${expression.day.id}`} className="text-teal-700">{expression.day.title}</Link> : null}
        </div>
        <h1 className="text-3xl font-black text-ink">{expression.english}</h1>
        <p className="text-lg font-semibold leading-7 text-slate-700">{expression.korean_prompt}</p>
      </div>
      <div className="space-y-4">
        {expression.grammar_note ? <InfoBlock title="문법/패턴" body={expression.grammar_note} /> : null}
        {expression.examples.length > 0 ? <section className="rounded-3xl bg-white p-5 shadow-card"><h2 className="text-sm font-black uppercase tracking-wide text-slate-500">비슷한 표현</h2><ul className="mt-3 space-y-3">{expression.examples.map((example) => <li key={example.id} className="rounded-2xl bg-slate-50 p-4"><p className="font-semibold text-ink">{example.example_text}</p>{example.meaning_ko ? <p className="mt-1 text-sm text-slate-600">{example.meaning_ko}</p> : null}</li>)}</ul></section> : null}
      </div>
      <ExpressionMemoForm expression={expression} />
    </div>
  );
}
function InfoBlock({ title, body }: { title: string; body: string }) { return <section className="rounded-3xl bg-white p-5 shadow-card"><h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2><p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{body}</p></section>; }
