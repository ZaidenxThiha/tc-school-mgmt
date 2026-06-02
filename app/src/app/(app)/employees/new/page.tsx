import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


const CATEGORIES = [
  ['esl_teacher','ESL Teacher'],['admin_teacher','Admin Teacher'],
  ['admin_staff','Admin Staff'],['helper','Helper'],
  ['security','Security'],['cleaner','Cleaner'],
  ['driver','Driver'],['accountant','Accountant'],
  ['owner','Owner'],['other','Other'],
] as const;

async function create(formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);
  const short = String(formData.get('short_name') ?? '').trim();
  const full  = String(formData.get('full_name') ?? '').trim() || short;
  if (!short) return;
  await sql`insert into employees (short_name, full_name, category, phone, email, address, start_date, monthly_salary, is_active, notes)
    values (${short}, ${full}, ${String(formData.get('category') ?? 'other')},
            ${String(formData.get('phone') ?? '').trim() || null},
            ${String(formData.get('email') ?? '').trim() || null},
            ${String(formData.get('address') ?? '').trim() || null},
            ${String(formData.get('start_date') ?? '') || null},
            ${Number(formData.get('monthly_salary') ?? 0) || null},
            ${formData.get('is_active') === 'on'},
            ${String(formData.get('notes') ?? '').trim() || null})`;
  redirect('/employees');
}

export default function NewEmployee() {
  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title="Add employee" subtitle="Any staff category" />
      <form action={create} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Short name</label>
            <input name="short_name" required className="input" placeholder="Tr Jane / Aunty Htay / U Aung" /></div>
          <div><label className="label">Full name</label>
            <input name="full_name" className="input" placeholder="(defaults to short name)" /></div>
          <div><label className="label">Category</label>
            <select name="category" required defaultValue="esl_teacher" className="input">
              {CATEGORIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><label className="label">Phone</label>
            <input name="phone" className="input" placeholder="09…" /></div>
          <div><label className="label">Email</label>
            <input name="email" type="email" className="input" /></div>
          <div><label className="label">Start date</label>
            <input name="start_date" type="date" className="input" /></div>
          <div><label className="label">Monthly salary (MMK)</label>
            <input name="monthly_salary" type="number" min="0" className="input" /></div>
          <div className="flex items-end"><label className="label inline-flex items-center gap-2 mb-2">
            <input name="is_active" type="checkbox" defaultChecked /> Active</label></div>
          <div className="col-span-2"><label className="label">Address</label>
            <input name="address" className="input" /></div>
          <div className="col-span-2"><label className="label">Notes</label>
            <textarea name="notes" className="input min-h-[60px]" /></div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/employees" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
