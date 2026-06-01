import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import { shortDate } from '@/lib/format';
import Pagination, { parsePage } from '@/components/pagination';
import SearchInput from '@/components/search-input';

const STATUS_OPTIONS = ['Active', 'Break', 'Left'] as const;

function statusBadge(status: string) {
  return status === 'Active' ? 'badge-green' : status === 'Break' ? 'badge-amber' : 'badge-rose';
}

type Row = {
  id: number; start_date: string | Date; end_date: string | Date | null; status: string;
  student_id: number; english_name: string | null; myanmar_name: string | null;
  section_id: number | null; time_slot: string | null; is_online: boolean | null; level_name: string | null;
  full_count: number;
};

export default async function EnrolmentsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; status?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status = sp.status ?? '';
  const { page, pageSize, from } = parsePage(sp, 50);

  const statusCond = status ? sql`and e.status = ${status}` : sql``;
  const searchCond = q ? sql`and (st.english_name ilike ${'%' + q + '%'} or st.myanmar_name ilike ${'%' + q + '%'})` : sql``;

  const enrolments = (await sql`
    select e.id, e.start_date, e.end_date, e.status,
           st.id as student_id, st.english_name, st.myanmar_name,
           sec.id as section_id, sec.time_slot, sec.is_online, l.name as level_name,
           count(*) over()::int as full_count
    from enrolments e
    join students st on st.id = e.student_id
    left join sections sec on sec.id = e.section_id
    left join levels l on l.id = sec.level_id
    where true ${statusCond} ${searchCond}
    order by e.id desc
    limit ${pageSize} offset ${from}
  `) as unknown as Row[];
  const count = enrolments[0]?.full_count ?? 0;

  return (
    <div className="page">
      <PageHeader title="Enrollment" subtitle={`${count.toLocaleString('en-US')} total`}
        actions={<Link href="/enrolments/new" className="btn-primary">+ Enroll student</Link>} />

      <form className="flex flex-wrap gap-2 mb-4">
        <SearchInput defaultValue={q} placeholder="Search student name…" className="input max-w-sm" />
        <select name="status" defaultValue={status} className="input max-w-[160px]">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-ghost">Filter</button>
        {(q || status) && <a href="/enrolments" className="btn-ghost">Clear</a>}
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>#</th><th>Student</th><th>Section</th><th>Status</th>
              <th>Start</th><th>End</th><th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {enrolments.map((e) => {
                const del = deleteRow.bind(null, 'enrolments', e.id, '/enrolments');
                return (
                  <tr key={e.id}>
                    <td className="text-slate-400">{e.id}</td>
                    <td className="font-medium">
                      <Link href={`/students/${e.student_id}`} className="text-brand-600 hover:underline">{e.english_name ?? e.myanmar_name ?? '—'}</Link>
                    </td>
                    <td>
                      {e.section_id ? (
                        <Link href={`/sections/${e.section_id}`} className="text-brand-600 hover:underline">
                          {e.level_name ?? '?'} <span className="text-slate-500">({e.time_slot}{e.is_online ? ' · Online' : ''})</span>
                        </Link>
                      ) : '—'}
                    </td>
                    <td><span className={statusBadge(e.status)}>{e.status}</span></td>
                    <td>{shortDate(e.start_date)}</td>
                    <td>{shortDate(e.end_date)}</td>
                    <td className="text-right">
                      <Link href={`/enrolments/${e.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <DeleteButton action={del} label="Remove" description="Remove this enrolment. Cannot be undone." />
                    </td>
                  </tr>
                );
              })}
              {enrolments.length === 0 && (
                <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No enrolments.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count} basePath="/enrolments" query={{ q, status }} />
      </div>
    </div>
  );
}
