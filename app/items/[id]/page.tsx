import Link from "next/link";
import { notFound } from "next/navigation";

import { ItemNotesForm } from "@/components/ItemNotesForm";
import { StatusPill } from "@/components/StatusPill";
import { requireCurrentUser } from "@/lib/auth";
import { getLessonStore } from "@/lib/lesson-store";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({ params }: { params: Params }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const item = await getLessonStore(user).getItem(id);
  if (!item) notFound();

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <StatusPill status={item.status} />
          {item.lesson ? (
            <Link href={`/lessons/${item.lesson.id}`} className="text-sm font-bold text-teal-700">
              {item.lesson.title}
            </Link>
          ) : null}
        </div>
        <h1 className="text-3xl font-black text-ink">{item.expression}</h1>
        <p className="text-lg font-semibold leading-7 text-slate-700">{item.meaning_ko}</p>
      </div>

      <div className="space-y-4">
        {item.core_nuance ? <InfoBlock title="느낌 / 뉘앙스" body={item.core_nuance} /> : null}
        {item.structure_note ? <InfoBlock title="구조" body={item.structure_note} /> : null}
        {item.grammar_note ? <InfoBlock title="문법 / 수업 메모" body={item.grammar_note} /> : null}
        <section className="rounded-3xl bg-white p-5 shadow-card">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">예문</h2>
          <ul className="mt-3 space-y-3">
            {item.examples.map((example) => (
              <li key={example.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-ink">{example.example_text}</p>
                {example.meaning_ko ? <p className="mt-1 text-sm text-slate-600">{example.meaning_ko}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <ItemNotesForm item={item} />
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-card">
      <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-700">{body}</p>
    </section>
  );
}
