import type { StudyStatus } from "@/lib/types";

const styles: Record<StudyStatus, string> = {
  new: "bg-sky-100 text-sky-800",
  learning: "bg-indigo-100 text-indigo-800",
  memorized: "bg-emerald-100 text-emerald-800",
  confusing: "bg-amber-100 text-amber-800"
};

const labels: Record<StudyStatus, string> = {
  new: "새 표현",
  learning: "학습 중",
  memorized: "암기함",
  confusing: "헷갈림"
};

export function StatusPill({ status }: { status: StudyStatus }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${styles[status]}`}>{labels[status]}</span>;
}
