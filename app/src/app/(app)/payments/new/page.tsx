import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import AutoSubmitSelect from '@/components/auto-submit-select';
import { mmk, monthLabel } from '@/lib/format';
import SubmitButton from '@/components/submit-button';

async function create(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const studentId = Number(formData.get('student_id'));
  const invoiceRaw = String(formData.get('invoice_id') ?? '');
  const invoiceId = invoiceRaw ? Number(invoiceRaw) : null;
  const amount = Number(formData.get('amount') ?? 0);

  if (!Number.isFinite(studentId) || studentId <= 0) throw new Error('Student is required');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero');

  const { error } = await supabase.from('payments').insert({
    student_id: studentId,
    invoice_id: invoiceId,            // trigger recomputes invoice status
    paid_at: String(formData.get('paid_at') ?? new Date().toISOString()),
    amount,
    channel: String(formData.get('channel') ?? 'cash'),
    note: String(formData.get('note') ?? '').trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/payments');
  revalidatePath('/billing');
  revalidatePath(`/students/${studentId}`);
  redirect('/payments');
}

export default async function NewPayment({
  searchParams,
}: { searchParams: Promise<{ student?: string; invoice?: string }> }) {
  const sp = await searchParams;
  const studentId = sp.student ? Number(sp.student) : null;
  const presetInvoice = sp.invoice ?? '';

  const supabase = await createClient();

  // If an invoice was passed but no student, resolve the student from it.
  let effectiveStudent = studentId;
  if (!effectiveStudent && presetInvoice) {
    const { data: inv } = await supabase.from('invoices').select('student_id').eq('id', Number(presetInvoice)).single();
    effectiveStudent = inv?.student_id ?? null;
  }

  const { data: students } = await supabase
    .from('students')
    .select('id, english_name, myanmar_name')
    .order('english_name')
    .limit(2000);

  // Open/partial invoices for the chosen student, with outstanding balance.
  type InvRow = { id: number; billing_month: string; total_amount: number; status: string; payments: { amount: number }[] | null };
  let openInvoices: { id: number; label: string; outstanding: number }[] = [];
  if (effectiveStudent) {
    const { data: invs } = await supabase
      .from('invoices')
      .select('id, billing_month, total_amount, status, payments(amount)')
      .eq('student_id', effectiveStudent)
      .in('status', ['open', 'partial'])
      .order('billing_month', { ascending: true });
    openInvoices = ((invs ?? []) as InvRow[]).map((i) => {
      const paid = (i.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
      const outstanding = Number(i.total_amount) - paid;
      return {
        id: i.id,
        outstanding,
        label: `#${i.id} · ${monthLabel(i.billing_month)} · ${mmk(outstanding)} due`,
      };
    });
  }

  const preselected = openInvoices.find((i) => String(i.id) === presetInvoice) ?? openInvoices[0];
  const defaultAmount = preselected?.outstanding && preselected.outstanding > 0 ? preselected.outstanding : '';

  return (
    <div className="page-narrow">
      <PageHeader title="Record payment" subtitle="Apply a payment to an open invoice" />

      {/* Step 1 — choose student (reloads their open invoices) */}
      <form className="card mb-4 space-y-2">
        <label className="label">Student</label>
        <AutoSubmitSelect
          name="student"
          param="student"
          value={effectiveStudent ? String(effectiveStudent) : ''}
          basePath="/payments/new"
          className="input"
        >
          <option value="">— select a student —</option>
          {students?.map((s) => (
            <option key={s.id} value={s.id}>{s.english_name ?? s.myanmar_name ?? `#${s.id}`} #{s.id}</option>
          ))}
        </AutoSubmitSelect>
        <noscript><button className="btn-ghost mt-2">Load invoices</button></noscript>
        {effectiveStudent && openInvoices.length === 0 && (
          <p className="text-xs text-amber-700">No open invoices for this student — the payment will be recorded as a general (unlinked) payment.</p>
        )}
      </form>

      {/* Step 2 — record the payment */}
      <form action={create} className="card space-y-4">
        <input type="hidden" name="student_id" value={effectiveStudent ?? ''} />
        <div>
          <label className="label">Apply to invoice</label>
          <select name="invoice_id" defaultValue={preselected ? String(preselected.id) : ''} className="input" disabled={!effectiveStudent}>
            <option value="">— general payment (no invoice) —</option>
            {openInvoices.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
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
