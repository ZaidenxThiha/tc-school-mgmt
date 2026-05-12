import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';


export default async function SectionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const supabase = await createClient();
  const [{ data: section }, { data: enrolments }, { data: teacherLinks }] = await Promise.all([
    supabase.from('sections').select('*, level:levels(name, code)').eq('id', id).single(),
    supabase.from('enrolments').select(`
      id, start_date, end_date, status,
      student:students(id, english_name, myanmar_name, current_status)
    `).eq('section_id', id).order('id'),
    supabase.from('section_teachers').select(`
      teacher_id, weekday_pattern,
      teacher:employees(id, short_name, full_name, category)
    `).eq('section_id', id),
  ]);

  if (!section) notFound();
  const level = section.level as unknown as { name: string; code: string } | null;
  const label = `${level?.name ?? '?'} (${section.time_slot})${section.is_online ? ' Online' : ''}`;

  const activeRoster = (enrolments ?? []).filter((e) => {
    const s = e.student as unknown as { current_status: string } | null;
    return s && (e.end_date == null) && s.current_status === 'Active';
  });

  return (
    <div className="page">
      <PageHeader title={label} subtitle={`Section #${id}`}
        actions={<Link href={`/sections/${id}/edit`} className="btn-ghost">Edit section</Link>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="text-xs uppercase text-slate-500">Active students</div>
          <div className="text-2xl font-semibold">{activeRoster.length}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-slate-500">Capacity</div>
          <div className="text-2xl font-semibold">{section.capacity ?? '—'}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-slate-500">Mode</div>
          <div className="text-2xl font-semibold">{section.is_online ? 'Online' : 'In-person'}</div>
        </div>
      </div>

      <section className="card p-0 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b font-medium">Teachers ({teacherLinks?.length ?? 0})</div>
        <table className="table">
          <thead><tr><th>Name</th><th>Category</th><th>Pattern</th></tr></thead>
          <tbody>
            {(teacherLinks ?? []).map((t) => {
              const e = t.teacher as unknown as { id: number; short_name: string; full_name: string; category: string } | null;
              if (!e) return null;
              return (
                <tr key={e.id}>
                  <td><Link href={`/employees/${e.id}/edit`} className="text-brand-600 hover:underline">{e.short_name}</Link></td>
                  <td><span className="badge-slate">{e.category}</span></td>
                  <td>{t.weekday_pattern ?? '—'}</td>
                </tr>
              );
            })}
            {(teacherLinks?.length ?? 0) === 0 && (
              <tr><td colSpan={3} className="text-slate-500 text-sm py-4 text-center">No teachers assigned.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">Roster ({enrolments?.length ?? 0} enrolments, {activeRoster.length} active)</div>
        <table className="table">
          <thead><tr><th>#</th><th>English Name</th><th>Myanmar Name</th><th>Status</th><th>Start</th><th>End</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {(enrolments ?? []).map((e, i) => {
              const st = e.student as unknown as { id: number; english_name: string | null; myanmar_name: string | null; current_status: string } | null;
              if (!st) return null;
              const del = deleteRow.bind(null, 'enrolments', e.id, `/sections/${id}`);
              const badge =
                st.current_status === 'Active' ? 'badge-green' :
                st.current_status === 'Break'  ? 'badge-amber' :
                'badge-rose';
              return (
                <tr key={e.id}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td><Link href={`/students/${st.id}`} className="text-brand-600 hover:underline">{st.english_name ?? '—'}</Link></td>
                  <td>{st.myanmar_name ?? '—'}</td>
                  <td><span className={badge}>{st.current_status}</span></td>
                  <td>{shortDate(e.start_date)}</td>
                  <td>{shortDate(e.end_date)}</td>
                  <td className="text-right"><DeleteButton action={del} label="Remove" description="Remove this student from the section. Cannot be undone." /></td>
                </tr>
              );
            })}
            {(enrolments?.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="text-slate-500 text-sm py-4 text-center">No students enrolled.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="mt-6">
        <Link href="/sections" className="text-sm text-slate-500 hover:text-slate-700">← Back to sections</Link>
      </div>
    </div>
  );
}
