import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';
import StudentCombobox from '@/components/student-combobox';
import { mmk, monthLabel } from '@/lib/format';
import SubmitButton from '@/components/submit-button';

async function create(formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  const studentId = Number(formData.get('student_id'));
  const invoiceRaw = String(formData.get('invoice_id') ?? '');
  const invoiceId = invoiceRaw ? Number(invoiceRaw) : null;
  const amount = Number(formData.get('amount') ?? 0);
  if (!Number.isFinite(studentId) || studentId <= 0) throw new Error('Student is required');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero');

  await sql`
    insert into payments (student_id, invoice_id, paid_at, amount, channel, note)
    values (${studentId}, ${invoiceId}, ${String(formData.get('paid_at') ?? '') || new Date().toISOString()},
            ${amount}, ${String(formData.get('channel') ?? 'cash')}, ${String(formData.get('note') ?? '').trim() || null})`;

  revalidatePath('/payments');
  revalidatePath('/billing');
  revalidatePath(`/students/${studentId}`);
  redirect('/payments');
}

export default async function NewPayment({
  searchParams,
}: { searchParams: Promise<{ student?: string; invoice?: string }> }) {
  const sp = await searchParams;
  const presetInvoice = sp.invoice ?? '';
  let effectiveStudent = sp.student ? Number(sp.student) : null;
  if (!effectiveStudent && presetInvoice) {
    const inv = await sql`select student_id from invoices where id = ${Number(presetInvoice)}`;
    effectiveStudent = inv[0]?.student_id ?? null;
  }

  const students = await sql`select id, english_name, myanmar_name from students order by english_name limit 2000`;

  type Open = { id: number; billing_month: string; total_amount: number; paid: number };
  let openInvoices: { id: number; label: string; outstanding: number }[] = [];
  if (effectiveStudent) {
    const invs = (await sql`
      select i.id, i.billing_month, i.total_amount, coalesce(sum(p.amount),0)::bigint as paid
      from invoices i left join payments p on p.invoice_id = i.id
      where i.student_id = ${effectiveStudent} and i.status in ('open','partial')
      group by i.id, i.billing_month, i.total_amount
      order by i.billing_month`) as unknown as Open[];
    openInvoices = invs.map((i) => {
      const outstanding = Number(i.total_amount) - Number(i.paid);
      return { id: i.id, outstanding, label: `#${i.id} · ${monthLabel(i.billing_month)} · ${mmk(outstanding)} due` };
    });
  }

  const preselected = openInvoices.find((i) => String(i.id) === presetInvoice) ?? openInvoices[0];
  const defaultAmount = preselected?.outstanding && preselected.outstanding > 0 ? preselected.outstanding : '';

  return (
    <div className="page-narrow">
      <PageHeader title="Record payment" subtitle="Apply a payment to an open invoice" />

      <form className="card mb-4 space-y-2">
        <label className="label">Student</label>
        <StudentCombobox
          param="student"
          basePath="/payments/new"
          defaultId={effectiveStudent ?? ''}
          options={(students as unknown as { id: number; english_name: string | null; myanmar_name: string | null }[]).map((s) => ({ id: s.id, label: `${s.english_name ?? s.myanmar_name ?? `#${s.id}`} #${s.id}` }))}
        />
        {effectiveStudent && openInvoices.length === 0 && (
          <p className="text-xs text-amber-700">No open invoices for this student — the payment will be recorded as a general (unlinked) payment.</p>
        )}
      </form>

      <form action={create} className="card space-y-4">
        <input type="hidden" name="student_id" value={effectiveStudent ?? ''} />
        <div>
          <label className="label">Apply to invoice</label>
          <select name="invoice_id" defaultValue={preselected ? String(preselected.id) : ''} className="input" disabled={!effectiveStudent}>
            <option value="">— general payment (no invoice) —</option>
            {openInvoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
          <p className="text-[11px] text-slate-500 mt-1">The invoice flips to <strong>paid</strong> (or <strong>partial</strong>) automatically based on total payments.</p>
        </div>
        <div className="form-grid-2">
          <div><label className="label">Date</label>
            <input name="paid_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></div>
          <div><label className="label">Amount (MMK)</label>
            <input name="amount" type="number" min="1" required defaultValue={defaultAmount} className="input" /></div>
          <div><label className="label">Channel</label>
            <select name="channel" defaultValue="cash" className="input">
              <option value="cash">Cash</option><option value="kpay">KPay</option>
              <option value="wave">Wave</option><option value="bank">Bank</option><option value="other">Other</option>
            </select></div>
        </div>
        <div><label className="label">Note</label>
          <textarea name="note" className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/payments" className="btn-ghost">Cancel</a>
          <SubmitButton pendingLabel="Recording…" className={`btn-primary ${!effectiveStudent ? 'opacity-60 pointer-events-none' : ''}`}>Record</SubmitButton>
        </div>
      </form>
    </div>
  );
}
