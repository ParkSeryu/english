export default function Loading() {
  return (
    <div className="space-y-5" role="status" aria-live="polite" aria-label="페이지 이동 중">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-3 w-24 animate-pulse rounded-full bg-teal-100" />
        <div className="mt-4 h-8 w-2/3 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-5 w-3/4 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-slate-100" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
