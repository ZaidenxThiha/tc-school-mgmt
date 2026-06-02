import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import { assertNoTeacherConflicts } from '@/lib/schedule-conflicts';
import PageHeader from '@/components/page-header';


const SLOTS = ['7:45-9:45','10-12','1-3','3:15-5:15'] as const;
const DAYS  = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'] as const;

async function save(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);
  const monthStr = String(formData.get('month') ?? '');
  const num = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== '' ? Number(v) : null;
  };
  const txt = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== '' ? String(v).trim() : null;
  };
  const monthIso = monthStr ? `${monthStr}-01` : null;
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
    { month: monthIso, day_of_week, time_slot, mt_employee_id: mt, ct_employee_id: ct, excludeId: id },
    employeeNames,
  );

  await sql`update schedule_assignments set
      month = ${monthIso}, day_of_week = ${day_of_week}, time_slot = ${time_slot},
      room_id = ${num('room_id')}, section_id = ${num('section_id')},
      class_label = ${txt('class_label')}, subject = ${txt('subject')},
      mt_employee_id = ${mt}, ct_employee_id = ${ct}, notes = ${txt('notes')}
    where id = ${id}`;
  redirect(`/schedule?month=${monthStr}`);
}

export default async function EditAssignment({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [aRows, rooms, sections, employees] = await Promise.all([
    sql`select *, to_char(month, 'YYYY-MM') as month_str from schedule_assignments where id = ${id}`,
    sql`select id, name, display_name from rooms order by id`,
    sql`select s.id, s.time_slot, s.is_online, json_build_object('name', l.name) as level from sections s join levels l on l.id = s.level_id order by s.id`,
    sql`select id, short_name, category from employees where is_active = true order by short_name`,
  ]);
  const a = aRows[0] as unknown as {
    day_of_week: string; time_slot: string; room_id: number | null; section_id: number | null;
    class_label: string | null; subject: string | null; mt_employee_id: number | null; ct_employee_id: number | null;
    notes: string | null; month_str: string;
  } | undefined;
  if (!a) notFound();
  const action = save.bind(null, id);
  const monthStr = a.month_str;
  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title={`Edit cell #${id}`} subtitle={`${a.day_of_week} · ${a.time_slot}`} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Month</label>
            <input name="month" type="month" required defaultValue={monthStr} className="input" /></div>
          <div><label className="label">Day</label>
            <select name="day_of_week" required defaultValue={a.day_of_week} className="input">
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </select></div>
          <div><label className="label">Time slot</label>
            <select name="time_slot" required defaultValue={a.time_slot} className="input">
              {SLOTS.map((s) => <option key={s}>{s}</option>)}
            </select></div>
          <div><label className="label">Room</label>
            <select name="room_id" defaultValue={a.room_id ?? ''} className="input">
              <option value="">—</option>
              {rooms?.map((r) => <option key={r.id} value={r.id}>{r.name}{r.display_name ? ` (${r.display_name})` : ''}</option>)}
            </select></div>
          <div><label className="label">Section</label>
            <select name="section_id" defaultValue={a.section_id ?? ''} className="input">
              <option value="">—</option>
              {sections?.map((s) => {
                const l = s.level as unknown as { name: string } | null;
                return <option key={s.id} value={s.id}>{l?.name} {s.time_slot}{s.is_online ? ' (Online)' : ''}</option>;
              })}
            </select></div>
          <div><label className="label">Class label</label>
            <input name="class_label" defaultValue={a.class_label ?? ''} className="input" /></div>
          <div><label className="label">Subject</label>
            <input name="subject" defaultValue={a.subject ?? ''} className="input" /></div>
          <div></div>
          <div><label className="label">Main Teacher (MT)</label>
            <select name="mt_employee_id" defaultValue={a.mt_employee_id ?? ''} className="input">
              <option value="">—</option>
              {employees?.map((e) => <option key={e.id} value={e.id}>{e.short_name}</option>)}
            </select></div>
          <div><label className="label">Class Teacher (CT)</label>
            <select name="ct_employee_id" defaultValue={a.ct_employee_id ?? ''} className="input">
              <option value="">—</option>
              {employees?.map((e) => <option key={e.id} value={e.id}>{e.short_name}</option>)}
            </select></div>
        </div>
        <div><label className="label">Notes</label>
          <textarea name="notes" defaultValue={a.notes ?? ''} className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href={`/schedule?month=${monthStr}`} className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
