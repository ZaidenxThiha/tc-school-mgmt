import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';
import StudentCombobox from '@/components/student-combobox';


async function create(formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  const num = (k: string) => Number(formData.get(k) ?? 0) || 0;
  const employee_id = Number(formData.get('employee_id'));
  if (!employee_id) throw new Error('Employee is required');
  const month_str = String(formData.get('pay_month') ?? '');
  const pay_month = month_str ? `${month_str}-01` : null;
  const mt_h = num('mt_hours'); const ct_h = num('ct_hours');
  const mt_a = num('mt_absence_hrs'); const ct_a = num('ct_absence_hrs');
  const emp = await sql`select mt_hourly_fee, ct_hourly_fee from employees where id = ${employee_id}`;
  const mt_fee = num('mt_hourly_fee') || Number(emp[0]?.mt_hourly_fee ?? 0) || 0;
  const ct_fee = num('ct_hourly_fee') || Number(emp[0]?.ct_hourly_fee ?? 0) || 0;
  const esl = Math.max(0, mt_h - mt_a) * mt_fee + Math.max(0, ct_h - ct_a) * ct_fee;
  await sql`insert into employee_payslips
    (employee_id, pay_month, mt_hours, ct_hours, mt_absence_hrs, ct_absence_hrs, mt_hourly_fee, ct_hourly_fee, esl_pay,
     management_pay, guide_pay, summer_pay, other_pay, payment_method, paid_at, notes)
    values (${employee_id}, ${pay_month}, ${mt_h}, ${ct_h}, ${mt_a}, ${ct_a}, ${mt_fee}, ${ct_fee}, ${esl},
            ${num('management_pay')}, ${num('guide_pay')}, ${num('summer_pay')}, ${num('other_pay')},
            ${String(formData.get('payment_method') ?? '') || null}, ${String(formData.get('paid_at') ?? '') || null},
            ${String(formData.get('notes') ?? '').trim() || null})`;
  redirect(`/payroll?month=${month_str}`);
}

export default async function NewPayslip({
  searchParams,
}: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const employees = (await sql`
    select id, short_name, full_name, category, mt_hourly_fee, ct_hourly_fee, monthly_salary
    from employees where is_active = true order by category, short_name
  `) as unknown as { id: number; short_name: string | null; category: string }[];
  return (
    <div className="page-narrow max-w-3xl">
      <PageHeader title="Add payslip" />
      <form action={create} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Employee</label>
            <StudentCombobox
              name="employee_id"
              placeholder="Search employee…"
              options={(employees ?? []).map((e) => ({ id: e.id, label: `${e.short_name ?? `#${e.id}`} (${e.category})` }))}
            /></div>
          <div><label className="label">Pay month</label>
            <input name="pay_month" type="month" required defaultValue={sp.month ?? new Date().toISOString().slice(0,7)} className="input" /></div>
          <div><label className="label">MT hours</label>
            <input name="mt_hours" type="number" step="0.5" min="0" defaultValue={0} className="input" /></div>
          <div><label className="label">CT hours</label>
            <input name="ct_hours" type="number" step="0.5" min="0" defaultValue={0} className="input" /></div>
          <div><label className="label">MT absence (hrs)</label>
            <input name="mt_absence_hrs" type="number" step="0.5" min="0" defaultValue={0} className="input" /></div>
          <div><label className="label">CT absence (hrs)</label>
            <input name="ct_absence_hrs" type="number" step="0.5" min="0" defaultValue={0} className="input" /></div>
          <div><label className="label">MT hourly fee (override)</label>
            <input name="mt_hourly_fee" type="number" min="0" placeholder="leaves blank → use employee default" className="input" /></div>
          <div><label className="label">CT hourly fee (override)</label>
            <input name="ct_hourly_fee" type="number" min="0" placeholder="leaves blank → use employee default" className="input" /></div>
          <div><label className="label">Management pay</label>
            <input name="management_pay" type="number" min="0" defaultValue={0} className="input" /></div>
          <div><label className="label">Guide pay</label>
            <input name="guide_pay" type="number" min="0" defaultValue={0} className="input" /></div>
          <div><label className="label">Summer pay</label>
            <input name="summer_pay" type="number" min="0" defaultValue={0} className="input" /></div>
          <div><label className="label">Other pay</label>
            <input name="other_pay" type="number" min="0" defaultValue={0} className="input" /></div>
          <div><label className="label">Paid at</label>
            <input name="paid_at" type="date" className="input" /></div>
          <div><label className="label">Method</label>
            <select name="payment_method" defaultValue="" className="input">
              <option value="">—</option>
              <option value="cash">Cash</option><option value="kpay">KPay</option>
              <option value="wave">Wave</option><option value="bank">Bank</option><option value="other">Other</option>
            </select></div>
        </div>
        <div><label className="label">Notes</label>
          <textarea name="notes" className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/payroll" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
