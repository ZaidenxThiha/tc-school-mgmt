// Group-level loading UI: shown instantly during navigation to any page in the
// (app) group while its data loads — gives immediate feedback (perceived speed)
// with no per-page work.
export default function Loading() {
  return (
    <div className="px-6 py-5 animate-pulse">
      {/* header */}
      <div className="flex items-center justify-between mb-5">
        <div className="h-6 w-48 bg-slate-200 rounded" />
        <div className="h-8 w-28 bg-slate-200 rounded-md" />
      </div>

      {/* stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-md px-3 py-3">
            <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
            <div className="h-5 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* table card */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="h-10 bg-slate-100 border-b border-slate-200" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100">
            <div className="h-4 w-8 bg-slate-200 rounded" />
            <div className="h-4 flex-1 max-w-[220px] bg-slate-200 rounded" />
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
