import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import { shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';
import SearchInput from '@/components/search-input';

type Row = {
  id: number; myanmar_name: string | null; english_name: string | null;
  current_status: string; enrolled_at: string | Date | null;
  guardian_phone: string | null; full_count: number;
};

export default async function StudentsPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? 'Active';
  const q = (sp.q ?? '').trim();
  const { page, pageSize, from } = parsePage(sp, 50);

  const statusCond = status !== 'all' ? sql`and s.current_status = ${status}` : sql``;
  const searchCond = q ? sql`and (s.english_name ilike ${'%' + q + '%'} or s.myanmar_name ilike ${'%' + q + '%'})` : sql``;

  const students = (await sql`
    select s.id, s.myanmar_name, s.english_name, s.current_status, s.enrolled_at,
           g.phone_primary as guardian_phone, count(*) over()::int as full_count
    from students s
    left join guardians g on g.id = s.guardian_id
    where true ${statusCond} ${searchCond}
    order by s.id desc
    limit ${pageSize} offset ${from}
  `) as unknown as Row[];
  const count = students[0]?.full_count ?? 0;

  return (
    <div className="page">
      <PageHeader
        title="Students"
        subtitle={`${count.toLocaleString('en-US')} matching · filter: ${status}`}
        actions={
          <>
            <a href={`/students/export?${new URLSearchParams({ q, status }).toString()}`} className="btn-ghost">Export CSV</a>
            <Link href="/students/new" className="btn-primary">+ Add student</Link>
          </>
        }
      />

      <form className="flex gap-2 mb-4">
        <SearchInput defaultValue={q} placeholder="Search English or Myanmar name…" className="input max-w-sm" />
        <select name="status" defaultValue={status} className="input max-w-[160px]">
          <option value="Active">Active</option>
          <option value="Break">Break</option>
          <option value="Left">Left</option>
          <option value="all">All</option>
        </select>
        <button className="btn-ghost">Filter</button>
        {(q || status !== 'Active') && <a href="/students" className="btn-ghost">Clear</a>}
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>English Name</th><th>Myanmar Name</th><th>Phone</th>
                <th>Status</th><th>Enrolled</th><th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No students in this filter.</td></tr>
              )}
              {students.map((s) => {
                const badge =
                  s.current_status === 'Active' ? 'badge-green' :
                  s.current_status === 'Break'  ? 'badge-amber' :
                  s.current_status === 'Left'   ? 'badge-rose'  : 'badge-slate';
                const del = deleteRow.bind(null, 'students', s.id, '/students');
                return (
                  <tr key={s.id}>
                    <td className="text-slate-400">{s.id}</td>
                    <td><Link href={`/students/${s.id}`} className="text-brand-600 hover:underline">{s.english_name ?? '—'}</Link></td>
                    <td>{s.myanmar_name ?? '—'}</td>
                    <td>{s.guardian_phone ?? '—'}</td>
                    <td><span className={badge}>{s.current_status}</span></td>
                    <td>{shortDate(s.enrolled_at)}</td>
                    <td className="text-right">
                      <Link href={`/students/${s.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <DeleteButton action={del} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count} basePath="/students" query={{ q, status }} />
      </div>
    </div>
  );
}
