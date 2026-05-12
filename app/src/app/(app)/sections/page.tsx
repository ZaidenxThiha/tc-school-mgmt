import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';


export default async function SectionsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const q = sp.q ?? '';
  const { page, pageSize, from, to } = parsePage(sp, 50);

  const supabase = await createClient();
  let query = supabase
    .from('sections')
    .select('id, time_slot, is_online, capacity, level:levels(code, name, display_order)', { count: 'exact' })
    .order('id');
  if (q) query = query.ilike('time_slot', `%${q}%`);

  const [{ data: sections, count }, { data: counts }] = await Promise.all([
    query.range(from, to),
    supabase.from('v_section_active_count').select('section_id, active_count'),
  ]);
  const countMap = new Map<number, number>(
    (counts ?? []).map((r) => [r.section_id as number, Number(r.active_count ?? 0)]),
  );

  const sorted = (sections ?? []).slice().sort((a, b) => {
    const la = (a.level as unknown as { display_order?: number } | null)?.display_order ?? 999;
    const lb = (b.level as unknown as { display_order?: number } | null)?.display_order ?? 999;
    return la === lb ? (a.time_slot ?? '').localeCompare(b.time_slot ?? '') : la - lb;
  });

  return (
    <div className="page">
      <PageHeader title="Sections" subtitle={`${(count ?? 0).toLocaleString('en-US')} matching`}
        actions={<Link href="/sections/new" className="btn-primary">+ Add section</Link>} />
      <form className="flex gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Search time slot…" className="input max-w-sm" />
        <button className="btn-ghost">Filter</button>
        {q && <a href="/sections" className="btn-ghost">Clear</a>}
      </form>
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>#</th><th>Level</th><th>Time slot</th><th>Mode</th>
              <th className="text-right">Active students</th>
              <th className="text-right">Capacity</th>
              <th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {sorted.map((s) => {
                const level = s.level as unknown as { name: string; code: string } | null;
                const del = deleteRow.bind(null, 'sections', s.id, '/sections');
                const active = countMap.get(s.id) ?? 0;
                const cap = s.capacity ?? null;
                const fillPct = cap && cap > 0 ? Math.min(100, Math.round((active / cap) * 100)) : null;
                return (
                  <tr key={s.id}>
                    <td className="text-slate-400">{s.id}</td>
                    <td className="font-medium">
                      <Link href={`/sections/${s.id}`} className="text-brand-600 hover:underline">{level?.name ?? '—'}</Link>
                    </td>
                    <td>{s.time_slot}</td>
                    <td>{s.is_online ? <span className="badge-amber">Online</span> : <span className="badge-slate">In-person</span>}</td>
                    <td className="text-right tabular-nums font-medium">{active}</td>
                    <td className="text-xs text-slate-500 text-right">
                      {cap ? `${cap}${fillPct !== null ? ` · ${fillPct}% full` : ''}` : '—'}
                    </td>
                    <td className="text-right">
                      <Link href={`/sections/${s.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <DeleteButton action={del} />
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No sections.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/sections" query={{ q }} />
      </div>
    </div>
  );
}
