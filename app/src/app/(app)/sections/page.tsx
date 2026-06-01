import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';

type Row = {
  id: number; time_slot: string; is_online: boolean; capacity: number | null;
  level: { name: string; code: string } | null; active_count: number; full_count: number;
};

export default async function SectionsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const { page, pageSize, from } = parsePage(sp, 50);

  const searchCond = q ? sql`and s.time_slot ilike ${'%' + q + '%'}` : sql``;
  const sorted = (await sql`
    select s.id, s.time_slot, s.is_online, s.capacity,
           json_build_object('name', l.name, 'code', l.code) as level,
           (select count(*)::int from enrolments e join students st on st.id = e.student_id
              where e.section_id = s.id and e.end_date is null and st.current_status = 'Active') as active_count,
           count(*) over()::int as full_count
    from sections s join levels l on l.id = s.level_id
    where true ${searchCond}
    order by l.display_order, s.time_slot
    limit ${pageSize} offset ${from}
  `) as unknown as Row[];
  const count = sorted[0]?.full_count ?? 0;

  return (
    <div className="page">
      <PageHeader title="Sections" subtitle={`${count.toLocaleString('en-US')} matching`}
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
                const del = deleteRow.bind(null, 'sections', s.id, '/sections');
                const active = s.active_count ?? 0;
                const cap = s.capacity ?? null;
                const fillPct = cap && cap > 0 ? Math.min(100, Math.round((active / cap) * 100)) : null;
                return (
                  <tr key={s.id}>
                    <td className="text-slate-400">{s.id}</td>
                    <td className="font-medium">
                      <Link href={`/sections/${s.id}`} className="text-brand-600 hover:underline">{s.level?.name ?? '—'}</Link>
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
        <Pagination page={page} pageSize={pageSize} total={count} basePath="/sections" query={{ q }} />
      </div>
    </div>
  );
}
