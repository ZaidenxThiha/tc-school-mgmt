import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';


export default async function AbsencesPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const month = sp.month ?? '';
  const q = sp.q ?? '';
  const { page, pageSize, from, to } = parsePage(sp, 50);

  const supabase = await createClient();
  let query = supabase
    .from('absences')
    .select(`id, absent_date, hours, role, reason, notes,
             employee:employees(id, short_name, full_name),
             section:sections(id, time_slot, level:levels(name))`, { count: 'exact' })
    .order('absent_date', { ascending: false });

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
    const end   = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    query = query.gte('absent_date', start).lt('absent_date', end);
  }
  // Note: we cannot filter by joined employee.short_name with .or() directly in a single statement easily;
  // for simplicity, filter in memory for the search box (small dataset).

  const { data: rowsRaw, count } = await query.range(from, to);
  const rows = (rowsRaw ?? []).filter((r) => {
    if (!q) return true;
    const e = r.employee as unknown as { short_name?: string; full_name?: string } | null;
    const hay = `${e?.short_name ?? ''} ${e?.full_name ?? ''} ${r.reason ?? ''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const totalHrs = rows.reduce((s, r) => s + Number(r.hours ?? 0), 0);

  return (
    <div className="page">
      <PageHeader
        title="Absences"
        subtitle={`${rows.length} of ${count ?? 0} matching · total ${totalHrs} hrs`}
        actions={<Link href="/absences/new" className="btn-primary">+ Log absence</Link>}
      />
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mb-4">
        ⚡ Auto-deduct enabled: changes here recalculate the matching <code>employee_payslips</code> row's
        absence hours and ESL pay.
      </div>
      <form className="flex gap-2 mb-4 flex-wrap">
        <input name="month" type="month" defaultValue={month} className="input max-w-[180px]" />
        <input name="q" defaultValue={q} placeholder="Search teacher / reason…" className="input max-w-sm" />
        <button className="btn-ghost">Filter</button>
        {(month || q) && <a href="/absences" className="btn-ghost">Clear</a>}
      </form>
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>#</th><th>Date</th><th>Teacher</th><th className="text-right">Hours</th><th>Role</th>
              <th>Section</th><th>Reason</th><th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((a) => {
                const e = a.employee as unknown as { id: number; short_name: string } | null;
                const sec = a.section as unknown as { id: number; time_slot: string; level: { name: string } | null } | null;
                const del = deleteRow.bind(null, 'absences', a.id, '/absences');
                return (
                  <tr key={a.id}>
                    <td className="text-slate-400">{a.id}</td>
                    <td>{shortDate(a.absent_date)}</td>
                    <td>{e ? <Link href={`/employees/${e.id}`} className="text-brand-600 hover:underline">{e.short_name}</Link> : '—'}</td>
                    <td className="tabular-nums text-rose-600">{a.hours}</td>
                    <td><span className={a.role === 'MT' ? 'badge-green' : 'badge-amber'}>{a.role}</span></td>
                    <td className="text-xs">{sec ? `${sec.level?.name ?? '?'} (${sec.time_slot})` : '—'}</td>
                    <td className="text-xs">{a.reason ?? '—'}</td>
                    <td className="text-right">
                      <Link href={`/absences/${a.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <DeleteButton action={del} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-slate-500 text-sm py-6 text-center">No absences in this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/absences" query={{ month, q }} />
      </div>
    </div>
  );
}
