import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertNoTeacherConflicts } from '@/lib/schedule-conflicts';
import PageHeader from '@/components/page-header';


const SLOTS = ['7:45-9:45','10-12','1-3','3:15-5:15'] as const;
const DAYS  = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'] as const;

async function save(id: number, formData: FormData) {
  'use server';
  const supabase = await createClient();
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
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, short_name');
    if (employeesError) throw new Error(employeesError.message);

    employeeNames = new Map(
      ((employees ?? []) as Array<{ id: number; short_name: string | null }>).map((employee) => [
        employee.id,
        employee.short_name ?? `#${employee.id}`,
      ]),
    );
  }

  await assertNoTeacherConflicts(
    supabase,
    {
      month: monthIso,
      day_of_week,
      time_slot,
      mt_employee_id: mt,
      ct_employee_id: ct,
      excludeId: id,
    },
    employeeNames,
  );

  const { error } = await supabase.from('schedule_assignments').update({
    month: monthIso,
    day_of_week,
    time_slot,
    room_id:     num('room_id'),
    section_id:  num('section_id'),
    class_label: txt('class_label'),
    subject:     txt('subject'),
    mt_employee_id: mt,
    ct_employee_id: ct,
    notes: txt('notes'),
  }).eq('id', id);
  if (error) throw new Error(error.message);
  redirect(`/schedule?month=${monthStr}`);
}

export default async function EditAssignment({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const supabase = await createClient();
  const [{ data: a }, { data: rooms }, { data: sections }, { data: employees }] = await Promise.all([
    supabase.from('schedule_assignments').select('*').eq('id', id).single(),
    supabase.from('rooms').select('id, name, display_name').order('id'),
    supabase.from('sections').select('id, time_slot, is_online, level:levels(name)').order('id'),
    supabase.from('employees').select('id, short_name, category').eq('is_active', true).order('short_name'),
  ]);
  if (!a) notFound();
  const action = save.bind(null, id);
  const monthStr = (a.month as string).slice(0, 7);
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
