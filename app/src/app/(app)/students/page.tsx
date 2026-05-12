import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';


export default async function StudentsPage({
  searchParams,
}: { searchParams: Promise<{ status?: string; q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? 'Active';
  const q = sp.q ?? '';
  const { page, pageSize, from, to } = parsePage(sp, 50);

  const supabase = await createClient();
  let query = supabase
    .from('students')
    .select('id, myanmar_name, english_name, current_status, enrolled_at, guardian:guardians(phone_primary)', { count: 'exact' })
    .order('id', { ascending: false });

  if (status !== 'all') query = query.eq('current_status', status);
  if (q) query = query.or(`english_name.ilike.%${q}%,myanmar_name.ilike.%${q}%`);

  const { data: students, count, error } = await query.range(from, to);

  return (
    <div className="page">
      <PageHeader
        title="Students"
        subtitle={`${(count ?? 0).toLocaleString('en-US')} matching · filter: ${status}`}
        actions={<Link href="/students/new" className="btn-primary">+ Add student</Link>}
      />

      <form className="flex gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Search English or Myanmar name…" className="input max-w-sm" />
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
                <th>#</th>
                <th>English Name</th>
                <th>Myanmar Name</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Enrolled</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={7} className="text-rose-700 text-sm">{error.message}</td></tr>}
              {!error && (students?.length ?? 0) === 0 && (
                <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No students in this filter.</td></tr>
              )}
              {students?.map((s) => {
                const phone = (s.guardian as unknown as { phone_primary?: string } | null)?.phone_primary ?? '—';
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
                    <td>{phone}</td>
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
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/students" query={{ q, status }} />
      </div>
    </div>
  );
}
