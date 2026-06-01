import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import { saveEnrolment } from '@/lib/actions/enrolment';

export default async function EditEnrolmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const rows = await sql`
    select e.id, to_char(e.start_date,'YYYY-MM-DD') as start_date, to_char(e.end_date,'YYYY-MM-DD') as end_date, e.status,
           json_build_object('english_name', st.english_name, 'myanmar_name', st.myanmar_name) as student,
           case when sec.id is null then null else json_build_object('time_slot', sec.time_slot, 'is_online', sec.is_online, 'level', json_build_object('name', l.name)) end as section
    from enrolments e join students st on st.id = e.student_id
    left join sections sec on sec.id = e.section_id left join levels l on l.id = sec.level_id
    where e.id = ${id}`;
  const e = rows[0] as unknown as {
    id: number; start_date: string | null; end_date: string | null; status: string;
    student: { english_name: string | null; myanmar_name: string | null } | null;
    section: { time_slot: string; is_online: boolean; level: { name: string } | null } | null;
  } | undefined;
  if (!e) notFound();

  const st = e.student;
  const sec = e.section;
  const studentName = st?.english_name ?? st?.myanmar_name ?? '—';
  const sectionLabel = sec ? `${sec.level?.name ?? '?'} (${sec.time_slot}${sec.is_online ? ' · Online' : ''})` : '—';

  const action = saveEnrolment.bind(null, id);

  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title={`Edit enrolment #${id}`} subtitle={`${studentName} · ${sectionLabel}`} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div>
            <label className="label">Start date</label>
            <input name="start_date" type="date" required defaultValue={e.start_date ?? ''} className="input" />
          </div>
          <div>
            <label className="label">End date</label>
            <input name="end_date" type="date" defaultValue={e.end_date ?? ''} className="input" />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue={e.status} className="input">
              <option>Active</option>
              <option>Break</option>
              <option>Left</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500">Setting status to <strong>Left</strong> without an end date fills today automatically.</p>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/enrolments" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
