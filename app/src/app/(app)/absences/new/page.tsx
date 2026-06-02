import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import { money } from '@/lib/form';
import PageHeader from '@/components/page-header';
import StudentCombobox from '@/components/student-combobox';


async function create(formData: FormData) {
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
  const employeeId = Number(formData.get('employee_id'));
  if (!employeeId) throw new Error('Employee is required');
  await sql`insert into absences (employee_id, absent_date, hours, role, section_id, reason, notes)
    values (${employeeId}, ${String(formData.get('absent_date') ?? '')}, ${money(formData, 'hours')},
            ${String(formData.get('role') ?? 'MT')}, ${num('section_id')}, ${txt('reason')}, ${txt('notes')})`;
  redirect('/absences');
}

export default async function NewAbsence() {
  const [employees, sections] = await Promise.all([
    sql`select id, short_name, category from employees where is_active = true order by short_name`,
    sql`select s.id, s.time_slot, s.is_online, json_build_object('name', l.name) as level from sections s join levels l on l.id = s.level_id order by s.id`,
  ]) as unknown as [{ id: number; short_name: string | null; category: string }[], { id: number; time_slot: string; is_online: boolean; level: { name: string } | null }[]];
  return (
    <div className="page-narrow max-w-xl">
      <PageHeader title="Log absence" subtitle="Auto-deducts from the matching month's payslip." />
      <form action={create} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Employee</label>
            <StudentCombobox
              name="employee_id"
              placeholder="Search employee…"
              options={(employees ?? []).map((e) => ({ id: e.id, label: `${e.short_name ?? `#${e.id}`}${e.category ? ` (${e.category})` : ''}` }))}
            /></div>
          <div><label className="label">Date</label>
            <input name="absent_date" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="input" /></div>
          <div><label className="label">Hours</label>
            <input name="hours" type="number" step="0.5" min="0.5" required defaultValue={2} className="input" /></div>
          <div><label className="label">Role</label>
            <select name="role" defaultValue="MT" className="input">
              <option value="MT">MT (Main Teacher)</option>
              <option value="CT">CT (Class Teacher)</option>
              <option value="OTHER">Other</option>
            </select></div>
          <div className="sm:col-span-2"><label className="label">Section (optional)</label>
            <select name="section_id" className="input">
              <option value="">—</option>
              {sections?.map((s) => {
                const l = s.level as unknown as { name: string } | null;
                return <option key={s.id} value={s.id}>{l?.name} {s.time_slot}{s.is_online ? ' (Online)' : ''}</option>;
              })}
            </select></div>
        </div>
        <div><label className="label">Reason</label>
          <input name="reason" className="input" placeholder="Sick / Eid / Family / …" /></div>
        <div><label className="label">Notes</label>
          <textarea name="notes" className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/absences" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Log</button>
        </div>
      </form>
    </div>
  );
}
