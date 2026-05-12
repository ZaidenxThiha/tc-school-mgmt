import Link from 'next/link';

export default function Pagination({
  page, pageSize, total, basePath, query = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end   = Math.min(safePage * pageSize, total);

  const buildUrl = (p: number) => {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, v));
    qs.set('page', String(p));
    qs.set('pageSize', String(pageSize));
    return `${basePath}?${qs.toString()}`;
  };

  // Build deduped page-number window
  const radius = 2;
  const pageSet = new Set<number>([1, totalPages]);
  for (let p = safePage - radius; p <= safePage + radius; p++) {
    if (p >= 1 && p <= totalPages) pageSet.add(p);
  }
  const sortedPages = Array.from(pageSet).sort((a, b) => a - b);

  // Insert ellipses where there's a gap > 1
  type Item = { kind: 'page'; n: number } | { kind: 'gap' };
  const items: Item[] = [];
  for (let i = 0; i < sortedPages.length; i++) {
    const n = sortedPages[i];
    if (i > 0 && n - sortedPages[i - 1] > 1) items.push({ kind: 'gap' });
    items.push({ kind: 'page', n });
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm flex-wrap gap-2">
      <div className="text-slate-500">
        {total === 0 ? 'No rows' : (
          <>
            Showing <span className="font-medium text-slate-700">{start.toLocaleString('en-US')}–{end.toLocaleString('en-US')}</span>
            {' '}of <span className="font-medium text-slate-700">{total.toLocaleString('en-US')}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={buildUrl(Math.max(1, safePage - 1))}
          aria-disabled={safePage <= 1}
          className={`px-2 py-1 rounded border ${safePage <= 1 ? 'text-slate-300 border-slate-200 pointer-events-none' : 'text-slate-700 border-slate-300 hover:bg-slate-50'}`}
        >‹ Prev</Link>
        {items.map((it, idx) =>
          it.kind === 'gap' ? (
            <span key={`gap-${idx}`} className="px-2 text-slate-400">…</span>
          ) : (
            <Link
              key={`p-${it.n}`}
              href={buildUrl(it.n)}
              className={`min-w-[34px] text-center px-2 py-1 rounded border ${
                it.n === safePage ? 'bg-brand-600 text-white border-brand-600' : 'text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >{it.n}</Link>
          )
        )}
        <Link
          href={buildUrl(Math.min(totalPages, safePage + 1))}
          aria-disabled={safePage >= totalPages}
          className={`px-2 py-1 rounded border ${safePage >= totalPages ? 'text-slate-300 border-slate-200 pointer-events-none' : 'text-slate-700 border-slate-300 hover:bg-slate-50'}`}
        >Next ›</Link>
      </div>
    </div>
  );
}

export function parsePage(sp: { page?: string | string[]; pageSize?: string | string[] }, defaultSize = 50) {
  // Defensively handle string[] (URL repeats) by taking the last value
  const pickStr = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[v.length - 1] : v;
  const rawPage     = Number(pickStr(sp.page) ?? 1);
  const rawPageSize = Number(pickStr(sp.pageSize) ?? defaultSize);
  const page = Math.max(1, Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1);
  const pageSize = Math.min(500, Math.max(10, Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.floor(rawPageSize) : defaultSize));
  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;
  return { page, pageSize, from, to };
}
