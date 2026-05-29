import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
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

export default async function EnrolmentsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; status?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const q = sp.q ?? '';
  const status = sp.status ?? '';
  const { page, pageSize, from, to } = parsePage(sp, 50);

  const supabase = await createClient();
  // `students!inner` lets the name search filter (and the exact count) run in
  // the database across the whole table, not just the current page.
  let query = supabase
    .from('enrolments')
    .select(`
      id, start_date, end_date, status,
      student:students!inner(id, english_name, myanmar_name),
      section:sections(id, time_slot, is_online, level:levels(name, code))
    `, { count: 'exact' })
    .order('id', { ascending: false });
  if (status) query = query.eq('status', status);
  if (q.trim()) {
    const term = q.trim();
    query = query.or(`english_name.ilike.%${term}%,myanmar_name.ilike.%${term}%`, { referencedTable: 'student' });
  }

  const { data, count } = await query.range(from, to);
  const enrolments = data ?? [];

  return (
    <div className="page">
      <PageHeader title="Enrollment" subtitle={`${(count ?? 0).toLocaleString('en-US')} total`}
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
                const st = e.student as unknown as { id: number; english_name: string | null; myanmar_name: string | null } | null;
                const sec = e.section as unknown as { id: number; time_slot: string; is_online: boolean; level: { name: string } | null } | null;
                const del = deleteRow.bind(null, 'enrolments', e.id, '/enrolments');
                return (
                  <tr key={e.id}>
                    <td className="text-slate-400">{e.id}</td>
                    <td className="font-medium">
                      {st ? <Link href={`/students/${st.id}`} className="text-brand-600 hover:underline">{st.english_name ?? st.myanmar_name ?? '—'}</Link> : '—'}
                    </td>
                    <td>
                      {sec ? (
                        <Link href={`/sections/${sec.id}`} className="text-brand-600 hover:underline">
                          {sec.level?.name ?? '?'} <span className="text-slate-500">({sec.time_slot}{sec.is_online ? ' · Online' : ''})</span>
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
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/enrolments" query={{ q, status }} />
      </div>
    </div>
  );
}
