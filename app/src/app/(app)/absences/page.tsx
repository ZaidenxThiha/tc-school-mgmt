import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import { shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';

type Row = {
  id: number; absent_date: string | Date; hours: number; role: string; reason: string | null;
  employee_id: number | null; short_name: string | null;
  section_id: number | null; time_slot: string | null; level_name: string | null; full_count: number;
};

export default async function AbsencesPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const month = sp.month ?? '';
  const q = (sp.q ?? '').trim();
  const { page, pageSize, from } = parsePage(sp, 50);

  let monthCond = sql``;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    monthCond = sql`and a.absent_date >= ${start} and a.absent_date < ${end}`;
  }
  const t = '%' + q + '%';
  const searchCond = q ? sql`and (e.short_name ilike ${t} or e.full_name ilike ${t} or a.reason ilike ${t})` : sql``;

  const rows = (await sql`
    select a.id, a.absent_date, a.hours, a.role, a.reason,
           e.id as employee_id, e.short_name,
           sec.id as section_id, sec.time_slot, l.name as level_name,
           count(*) over()::int as full_count
    from absences a
    left join employees e on e.id = a.employee_id
    left join sections sec on sec.id = a.section_id
    left join levels l on l.id = sec.level_id
    where true ${monthCond} ${searchCond}
    order by a.absent_date desc
    limit ${pageSize} offset ${from}
  `) as unknown as Row[];
  const count = rows[0]?.full_count ?? 0;
  const totalHrs = rows.reduce((s, r) => s + Number(r.hours ?? 0), 0);

  return (
    <div className="page">
      <PageHeader
        title="Absences"
        subtitle={`${rows.length} of ${count} matching · total ${totalHrs} hrs`}
        actions={<Link href="/absences/new" className="btn-primary">+ Log absence</Link>}
      />
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 mb-4">
        ⚡ Absences feed payslip deductions: re-running payroll &quot;Generate&quot; for the month applies these absence hours to ESL pay.
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
                const del = deleteRow.bind(null, 'absences', a.id, '/absences');
                return (
                  <tr key={a.id}>
                    <td className="text-slate-400">{a.id}</td>
                    <td>{shortDate(a.absent_date)}</td>
                    <td>{a.employee_id ? <Link href={`/employees/${a.employee_id}`} className="text-brand-600 hover:underline">{a.short_name}</Link> : '—'}</td>
                    <td className="tabular-nums text-rose-600">{a.hours}</td>
                    <td><span className={a.role === 'MT' ? 'badge-green' : 'badge-amber'}>{a.role}</span></td>
                    <td className="text-xs">{a.section_id ? `${a.level_name ?? '?'} (${a.time_slot})` : '—'}</td>
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
        <Pagination page={page} pageSize={pageSize} total={count} basePath="/absences" query={{ month, q }} />
      </div>
    </div>
  );
}
