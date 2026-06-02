import { notFound, redirect } from 'next/navigation';
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
  await sql`update employees set
    short_name = ${String(formData.get('short_name') ?? '').trim()},
    full_name = ${String(formData.get('full_name') ?? '').trim()},
    category = ${String(formData.get('category') ?? 'other')},
    phone = ${txt('phone')}, email = ${txt('email')}, address = ${txt('address')},
    date_of_birth = ${txt('date_of_birth')}, national_id = ${txt('national_id')},
    emergency_contact = ${txt('emergency_contact')}, position_title = ${txt('position_title')},
    education_level = ${txt('education_level')}, degree = ${txt('degree')},
    available_slots = ${txt('available_slots')}, start_date = ${txt('start_date')}, end_date = ${txt('end_date')},
    monthly_salary = ${num('monthly_salary')}, mt_hourly_fee = ${num('mt_hourly_fee')}, ct_hourly_fee = ${num('ct_hourly_fee')},
    is_active = ${formData.get('is_active') === 'on'}, notes = ${txt('notes')}
    where id = ${id}`;
  redirect('/employees');
}

export default async function EditEmployee({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const rows = await sql`select short_name, full_name, category, position_title, national_id, phone, email, address,
      emergency_contact, education_level, degree, available_slots, monthly_salary, mt_hourly_fee, ct_hourly_fee, is_active, notes,
      to_char(date_of_birth,'YYYY-MM-DD') as date_of_birth, to_char(start_date,'YYYY-MM-DD') as start_date, to_char(end_date,'YYYY-MM-DD') as end_date
    from employees where id = ${id}`;
  const e = rows[0] as unknown as {
    short_name: string; full_name: string; category: string; position_title: string | null; national_id: string | null;
    phone: string | null; email: string | null; address: string | null; emergency_contact: string | null;
    education_level: string | null; degree: string | null; available_slots: string | null;
    monthly_salary: number | null; mt_hourly_fee: number | null; ct_hourly_fee: number | null;
    is_active: boolean | null; notes: string | null; date_of_birth: string | null; start_date: string | null; end_date: string | null;
  } | undefined;
  if (!e) notFound();
  const action = save.bind(null, id);
  return (
    <div className="page-narrow max-w-3xl">
      <PageHeader title={`Edit ${e.short_name}`} subtitle={e.full_name} />
      <form action={action} className="space-y-4">
        <div className="card space-y-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Identity</div>
          <div className="form-grid-2">
            <div><label className="label">Short name</label>
              <input name="short_name" required defaultValue={e.short_name} className="input" /></div>
            <div><label className="label">Full name</label>
              <input name="full_name" defaultValue={e.full_name} className="input" /></div>
            <div><label className="label">Category</label>
              <select name="category" required defaultValue={e.category} className="input">
                {CATEGORIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="label">Position title</label>
              <input name="position_title" defaultValue={e.position_title ?? ''} className="input" placeholder="Main Teacher / Class Teacher / Admin / …" /></div>
            <div><label className="label">Date of birth</label>
              <input name="date_of_birth" type="date" defaultValue={e.date_of_birth ?? ''} className="input" /></div>
            <div><label className="label">National ID (NRC)</label>
              <input name="national_id" defaultValue={e.national_id ?? ''} className="input" /></div>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Contact</div>
          <div className="form-grid-2">
            <div><label className="label">Phone</label>
              <input name="phone" defaultValue={e.phone ?? ''} className="input" /></div>
            <div><label className="label">Email</label>
              <input name="email" type="email" defaultValue={e.email ?? ''} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Address</label>
              <input name="address" defaultValue={e.address ?? ''} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Emergency contact</label>
              <input name="emergency_contact" defaultValue={e.emergency_contact ?? ''} className="input" placeholder="Name, relationship, phone" /></div>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Education &amp; availability</div>
          <div className="form-grid-2">
            <div><label className="label">Education level</label>
              <input name="education_level" defaultValue={e.education_level ?? ''} className="input" placeholder="Bachelor's / Master's / Diploma" /></div>
            <div><label className="label">Degree / University</label>
              <input name="degree" defaultValue={e.degree ?? ''} className="input" /></div>
            <div className="sm:col-span-2"><label className="label">Available slots</label>
              <input name="available_slots" defaultValue={e.available_slots ?? ''} className="input" placeholder="Full-time / Opt-1, Opt-2, …" /></div>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Employment &amp; pay</div>
          <div className="form-grid-2">
            <div><label className="label">Start date</label>
              <input name="start_date" type="date" defaultValue={e.start_date ?? ''} className="input" /></div>
            <div><label className="label">End date</label>
              <input name="end_date" type="date" defaultValue={e.end_date ?? ''} className="input" /></div>
            <div><label className="label">Monthly salary (MMK)</label>
              <input name="monthly_salary" type="number" defaultValue={e.monthly_salary ?? ''} className="input" placeholder="(or use hourly below)" /></div>
            <div className="flex items-end"><label className="label inline-flex items-center gap-2 mb-2">
              <input name="is_active" type="checkbox" defaultChecked={e.is_active ?? false} /> Active</label></div>
            <div><label className="label">MT hourly fee (MMK)</label>
              <input name="mt_hourly_fee" type="number" defaultValue={e.mt_hourly_fee ?? ''} className="input" placeholder="Main teacher hourly" /></div>
            <div><label className="label">CT hourly fee (MMK)</label>
              <input name="ct_hourly_fee" type="number" defaultValue={e.ct_hourly_fee ?? ''} className="input" placeholder="Class teacher hourly" /></div>
          </div>
        </div>

        <div className="card space-y-3">
          <label className="label">Notes</label>
          <textarea name="notes" defaultValue={e.notes ?? ''} className="input min-h-[80px]" />
        </div>

        <div className="flex gap-2 justify-end pt-2 sticky bottom-0 bg-slate-50/80 backdrop-blur p-2 -mx-1 rounded">
          <a href="/employees" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
