import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);
  const num = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== '' ? Number(v) : null;
  };
  const txt = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== '' ? String(v).trim() : null;
  };
  await sql`update absences set
      employee_id = ${Number(formData.get('employee_id'))}, absent_date = ${String(formData.get('absent_date') ?? '')},
      hours = ${Number(formData.get('hours') ?? 0)}, role = ${String(formData.get('role') ?? 'MT')},
      section_id = ${num('section_id')}, reason = ${txt('reason')}, notes = ${txt('notes')}
    where id = ${id}`;
  redirect('/absences');
}

export default async function EditAbsence({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [aRows, employees, sections] = await Promise.all([
    sql`select employee_id, to_char(absent_date,'YYYY-MM-DD') as absent_date, hours, role, section_id, reason, notes from absences where id = ${id}`,
    sql`select id, short_name from employees where is_active = true order by short_name`,
    sql`select s.id, s.time_slot, s.is_online, json_build_object('name', l.name) as level from sections s join levels l on l.id = s.level_id order by s.id`,
  ]);
  const a = aRows[0] as unknown as { employee_id: number; absent_date: string; hours: number; role: string; section_id: number | null; reason: string | null; notes: string | null } | undefined;
  if (!a) notFound();
  const action = save.bind(null, id);
  return (
    <div className="page-narrow max-w-xl">
      <PageHeader title={`Edit absence #${id}`} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Employee</label>
            <select name="employee_id" required defaultValue={a.employee_id} className="input">
              {employees?.map((e) => <option key={e.id} value={e.id}>{e.short_name}</option>)}
            </select></div>
          <div><label className="label">Date</label>
            <input name="absent_date" type="date" required defaultValue={a.absent_date} className="input" /></div>
          <div><label className="label">Hours</label>
            <input name="hours" type="number" step="0.5" min="0.5" required defaultValue={a.hours} className="input" /></div>
          <div><label className="label">Role</label>
            <select name="role" defaultValue={a.role} className="input">
              <option value="MT">MT</option><option value="CT">CT</option><option value="OTHER">Other</option>
            </select></div>
          <div className="sm:col-span-2"><label className="label">Section (optional)</label>
            <select name="section_id" defaultValue={a.section_id ?? ''} className="input">
              <option value="">—</option>
              {sections?.map((s) => {
                const l = s.level as unknown as { name: string } | null;
                return <option key={s.id} value={s.id}>{l?.name} {s.time_slot}{s.is_online ? ' (Online)' : ''}</option>;
              })}
            </select></div>
        </div>
        <div><label className="label">Reason</label>
          <input name="reason" defaultValue={a.reason ?? ''} className="input" /></div>
        <div><label className="label">Notes</label>
          <textarea name="notes" defaultValue={a.notes ?? ''} className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/absences" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
