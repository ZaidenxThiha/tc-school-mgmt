import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import { assertNoTeacherConflicts } from '@/lib/schedule-conflicts';
import PageHeader from '@/components/page-header';
import StudentCombobox from '@/components/student-combobox';


const SLOTS = ['7:45-9:45','10-12','1-3','3:15-5:15'] as const;
const DAYS  = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'] as const;

async function create(formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);
  const monthStr = String(formData.get('month') ?? '');
  const monthIso = monthStr ? `${monthStr}-01` : null;
  const num = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== '' ? Number(v) : null;
  };
  const txt = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== '' ? String(v).trim() : null;
  };
  const day_of_week = String(formData.get('day_of_week'));
  const time_slot = String(formData.get('time_slot'));
  const mt = num('mt_employee_id');
  const ct = num('ct_employee_id');

  let employeeNames: Map<number, string> | undefined;
  if (mt !== null || ct !== null) {
    const employees = await sql`select id, short_name from employees`;
    employeeNames = new Map((employees as unknown as { id: number; short_name: string | null }[]).map((e) => [e.id, e.short_name ?? `#${e.id}`]));
  }

  await assertNoTeacherConflicts(
    { month: monthIso, day_of_week, time_slot, mt_employee_id: mt, ct_employee_id: ct },
    employeeNames,
  );

  await sql`insert into schedule_assignments (month, day_of_week, time_slot, room_id, section_id, class_label, subject, mt_employee_id, ct_employee_id, notes)
    values (${monthIso}, ${day_of_week}, ${time_slot}, ${num('room_id')}, ${num('section_id')}, ${txt('class_label')}, ${txt('subject')}, ${mt}, ${ct}, ${txt('notes')})`;
  redirect(`/schedule?month=${monthStr}`);
}

export default async function NewAssignment({
  searchParams,
}: { searchParams: Promise<{ month?: string; room?: string; day?: string; slot?: string }> }) {
  const sp = await searchParams;
  const [rooms, sections, employees] = await Promise.all([
    sql`select id, name, display_name from rooms order by id`,
    sql`select s.id, s.time_slot, s.is_online, json_build_object('name', l.name, 'code', l.code) as level from sections s join levels l on l.id = s.level_id order by s.id`,
    sql`select id, short_name, category from employees where is_active = true order by short_name`,
  ]) as unknown as [
    { id: number; name: string; display_name: string | null }[],
    { id: number; time_slot: string; is_online: boolean; level: { name: string } | null }[],
    { id: number; short_name: string | null }[],
  ];
  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title="Add schedule cell" />
      <form action={create} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Month</label>
            <input name="month" type="month" required defaultValue={sp.month ?? new Date().toISOString().slice(0,7)} className="input" /></div>
          <div><label className="label">Day</label>
            <select name="day_of_week" required defaultValue={sp.day ?? 'Sat'} className="input">
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select></div>
          <div><label className="label">Time slot</label>
            <select name="time_slot" required defaultValue={sp.slot ?? '10-12'} className="input">
              {SLOTS.map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div><label className="label">Room</label>
            <select name="room_id" defaultValue={sp.room ?? ''} className="input">
              <option value="">—</option>
              {rooms?.map((r) => <option key={r.id} value={r.id}>{r.name}{r.display_name ? ` (${r.display_name})` : ''}</option>)}
            </select></div>
          <div><label className="label">Section</label>
            <select name="section_id" className="input">
              <option value="">—</option>
              {sections?.map((s) => {
                const l = s.level as unknown as { name: string } | null;
                return <option key={s.id} value={s.id}>{l?.name} {s.time_slot}{s.is_online ? ' (Online)' : ''}</option>;
              })}
            </select></div>
          <div><label className="label">Class label (display)</label>
            <input name="class_label" className="input" placeholder="e.g. Nursery (10-12)" /></div>
          <div><label className="label">Subject</label>
            <input name="subject" className="input" placeholder="4 Skills / Reading / Phonic / …" /></div>
          <div></div>
          <div><label className="label">Main Teacher (MT)</label>
            <StudentCombobox name="mt_employee_id" placeholder="Search teacher…"
              options={(employees ?? []).map((e) => ({ id: e.id, label: e.short_name ?? `#${e.id}` }))} /></div>
          <div><label className="label">Class Teacher (CT)</label>
            <StudentCombobox name="ct_employee_id" placeholder="Search teacher…"
              options={(employees ?? []).map((e) => ({ id: e.id, label: e.short_name ?? `#${e.id}` }))} /></div>
        </div>
        <div><label className="label">Notes</label>
          <textarea name="notes" className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href={`/schedule?month=${sp.month ?? ''}`} className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
