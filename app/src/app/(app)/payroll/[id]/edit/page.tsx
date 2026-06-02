import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  const num = (k: string) => Number(formData.get(k) ?? 0) || 0;
  const mt_h = num('mt_hours'); const ct_h = num('ct_hours');
  const mt_a = num('mt_absence_hrs'); const ct_a = num('ct_absence_hrs');
  const mt_fee = num('mt_hourly_fee');
  const ct_fee = num('ct_hourly_fee');
  const esl = Math.max(0, mt_h - mt_a) * mt_fee + Math.max(0, ct_h - ct_a) * ct_fee;
  await sql`update employee_payslips set
      mt_hours = ${mt_h}, ct_hours = ${ct_h}, mt_absence_hrs = ${mt_a}, ct_absence_hrs = ${ct_a},
      mt_hourly_fee = ${mt_fee}, ct_hourly_fee = ${ct_fee}, esl_pay = ${esl},
      management_pay = ${num('management_pay')}, guide_pay = ${num('guide_pay')},
      summer_pay = ${num('summer_pay')}, other_pay = ${num('other_pay')},
      payment_method = ${String(formData.get('payment_method') ?? '') || null},
      paid_at = ${String(formData.get('paid_at') ?? '') || null},
      notes = ${String(formData.get('notes') ?? '').trim() || null}
    where id = ${id}`;
  redirect('/payroll');
}

export default async function EditPayslip({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const rows = await sql`
    select p.mt_hours, p.ct_hours, p.mt_absence_hrs, p.ct_absence_hrs, p.mt_hourly_fee, p.ct_hourly_fee,
           p.management_pay, p.guide_pay, p.summer_pay, p.other_pay, p.payment_method, p.notes,
           to_char(p.paid_at, 'YYYY-MM-DD') as paid_at, to_char(p.pay_month, 'YYYY-MM-DD') as pay_month,
           e.short_name, e.full_name
    from employee_payslips p join employees e on e.id = p.employee_id where p.id = ${id}`;
  const p = rows[0] as unknown as {
    mt_hours: number | null; ct_hours: number | null; mt_absence_hrs: number | null; ct_absence_hrs: number | null;
    mt_hourly_fee: number | null; ct_hourly_fee: number | null; management_pay: number | null; guide_pay: number | null;
    summer_pay: number | null; other_pay: number | null; payment_method: string | null; notes: string | null;
    paid_at: string | null; pay_month: string; short_name: string | null; full_name: string | null;
  } | undefined;
  if (!p) notFound();
  const action = save.bind(null, id);
  const e = { short_name: p.short_name ?? undefined, full_name: p.full_name ?? undefined };
  const monthLabel = new Date(p.pay_month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return (
    <div className="page-narrow max-w-3xl">
      <PageHeader title={`Edit payslip — ${e?.short_name ?? ''}`} subtitle={monthLabel} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">MT hours</label>
            <input name="mt_hours" type="number" step="0.5" required defaultValue={p.mt_hours ?? 0} className="input" /></div>
          <div><label className="label">CT hours</label>
            <input name="ct_hours" type="number" step="0.5" required defaultValue={p.ct_hours ?? 0} className="input" /></div>
          <div><label className="label">MT absence (hrs)</label>
            <input name="mt_absence_hrs" type="number" step="0.5" required defaultValue={p.mt_absence_hrs ?? 0} className="input" /></div>
          <div><label className="label">CT absence (hrs)</label>
            <input name="ct_absence_hrs" type="number" step="0.5" required defaultValue={p.ct_absence_hrs ?? 0} className="input" /></div>
          <div><label className="label">MT hourly fee</label>
            <input name="mt_hourly_fee" type="number" required defaultValue={p.mt_hourly_fee ?? 0} className="input" /></div>
          <div><label className="label">CT hourly fee</label>
            <input name="ct_hourly_fee" type="number" required defaultValue={p.ct_hourly_fee ?? 0} className="input" /></div>
          <div><label className="label">Management pay</label>
            <input name="management_pay" type="number" defaultValue={p.management_pay ?? 0} className="input" /></div>
          <div><label className="label">Guide pay</label>
            <input name="guide_pay" type="number" defaultValue={p.guide_pay ?? 0} className="input" /></div>
          <div><label className="label">Summer pay</label>
            <input name="summer_pay" type="number" defaultValue={p.summer_pay ?? 0} className="input" /></div>
          <div><label className="label">Other pay</label>
            <input name="other_pay" type="number" defaultValue={p.other_pay ?? 0} className="input" /></div>
          <div><label className="label">Paid at</label>
            <input name="paid_at" type="date" defaultValue={p.paid_at ?? ''} className="input" /></div>
          <div><label className="label">Method</label>
            <select name="payment_method" defaultValue={p.payment_method ?? ''} className="input">
              <option value="">—</option>
              <option value="cash">Cash</option><option value="kpay">KPay</option>
              <option value="wave">Wave</option><option value="bank">Bank</option><option value="other">Other</option>
            </select></div>
        </div>
        <div><label className="label">Notes</label>
          <textarea name="notes" defaultValue={p.notes ?? ''} className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/payroll" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
