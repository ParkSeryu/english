import Link from "next/link";

export function EmptyState({ title, body, actionHref, actionLabel }: { title: string; body: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn-primary mt-5 inline-flex">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
