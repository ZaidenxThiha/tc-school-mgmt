import { notFound } from 'next/navigation';
import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import { shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';


export default async function SectionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [sectionRows, enrolments, teacherLinks] = await Promise.all([
    sql`select s.*, json_build_object('name', l.name, 'code', l.code) as level
        from sections s join levels l on l.id = s.level_id where s.id = ${id}`,
    sql`select e.id, e.start_date, e.end_date, e.status,
          json_build_object('id', st.id, 'english_name', st.english_name, 'myanmar_name', st.myanmar_name, 'current_status', st.current_status) as student
        from enrolments e join students st on st.id = e.student_id where e.section_id = ${id} order by e.id`,
    sql`select t.teacher_id, t.weekday_pattern,
          json_build_object('id', emp.id, 'short_name', emp.short_name, 'full_name', emp.full_name, 'category', emp.category) as teacher
        from section_teachers t join employees emp on emp.id = t.teacher_id where t.section_id = ${id}`,
  ]);

  const section = sectionRows[0] as unknown as { time_slot: string; is_online: boolean; capacity: number | null; level: { name: string; code: string } | null } | undefined;
  if (!section) notFound();
  const level = section.level;
  const label = `${level?.name ?? '?'} (${section.time_slot})${section.is_online ? ' Online' : ''}`;

  const activeRoster = (enrolments ?? []).filter((e) => {
    const s = e.student as unknown as { current_status: string } | null;
    return s && (e.end_date == null) && s.current_status === 'Active';
  });

  return (
    <div className="page">
      <PageHeader title={label} subtitle={`Section #${id}`}
        actions={
          <div className="flex gap-2">
            <Link href={`/enrolments/new?section=${id}`} className="btn-primary">+ Enroll student</Link>
            <Link href={`/sections/${id}/edit`} className="btn-ghost">Edit section</Link>
          </div>
        } />

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
