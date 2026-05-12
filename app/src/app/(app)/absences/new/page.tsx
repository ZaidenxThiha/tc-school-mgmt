import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const num = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== '' ? Number(v) : null;
  };
  const txt = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== '' ? String(v).trim() : null;
  };
  const { error } = await supabase.from('absences').insert({
    employee_id: Number(formData.get('employee_id')),
    absent_date: String(formData.get('absent_date') ?? ''),
    hours: Number(formData.get('hours') ?? 0),
    role: String(formData.get('role') ?? 'MT'),
    section_id: num('section_id'),
    reason: txt('reason'),
    notes: txt('notes'),
  });
  if (error) throw new Error(error.message);
  redirect('/absences');
}

export default async function NewAbsence() {
  const supabase = await createClient();
  const [{ data: employees }, { data: sections }] = await Promise.all([
    supabase.from('employees').select('id, short_name, category').eq('is_active', true).order('short_name'),
    supabase.from('sections').select('id, time_slot, is_online, level:levels(name)').order('id'),
  ]);
  return (
    <div className="page-narrow max-w-xl">
      <PageHeader title="Log absence" subtitle="Auto-deducts from the matching month's payslip." />
      <form action={create} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Employee</label>
            <select name="employee_id" required className="input">
              <option value="">— select —</option>
              {employees?.map((e) => <option key={e.id} value={e.id}>{e.short_name}</option>)}
            </select></div>
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
