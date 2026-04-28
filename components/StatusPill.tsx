import type { CardStatus } from "@/lib/types";

const styles: Record<CardStatus, string> = {
  new: "bg-sky-100 text-sky-800",
  known: "bg-emerald-100 text-emerald-800",
  confusing: "bg-amber-100 text-amber-800"
};

const labels: Record<CardStatus, string> = {
  new: "새 카드",
  known: "알고 있음",
  confusing: "헷갈림"
};

export function StatusPill({ status }: { status: CardStatus }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${styles[status]}`}>{labels[status]}</span>;
}
