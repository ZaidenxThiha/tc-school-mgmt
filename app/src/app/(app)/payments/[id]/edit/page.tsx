import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import { money } from '@/lib/form';
import PageHeader from '@/components/page-header';

async function save(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  await sql`
    update payments set
      paid_at = ${String(formData.get('paid_at') ?? '')},
      amount = ${money(formData, 'amount')},
      channel = ${String(formData.get('channel') ?? 'cash')},
      note = ${String(formData.get('note') ?? '').trim() || null}
    where id = ${id}`;
  redirect('/payments');
}

export default async function EditPayment({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const rows = await sql`
    select p.amount, p.channel, p.note, to_char(p.paid_at, 'YYYY-MM-DD') as paid_at,
           st.english_name, st.myanmar_name
    from payments p left join students st on st.id = p.student_id
    where p.id = ${id}`;
  const p = rows[0] as unknown as {
    amount: number; channel: string; note: string | null; paid_at: string | null;
    english_name: string | null; myanmar_name: string | null;
  } | undefined;
  if (!p) notFound();
  const action = save.bind(null, id);
  return (
    <div className="page-narrow">
      <PageHeader title={`Edit payment #${id}`} subtitle={p.english_name ?? p.myanmar_name ?? ''} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Date</label>
            <input name="paid_at" type="date" required defaultValue={p.paid_at ?? ''} className="input" /></div>
          <div><label className="label">Amount (MMK)</label>
            <input name="amount" type="number" required defaultValue={p.amount ?? 0} className="input" /></div>
          <div><label className="label">Channel</label>
            <select name="channel" defaultValue={p.channel} className="input">
              <option value="cash">Cash</option><option value="kpay">KPay</option>
              <option value="wave">Wave</option><option value="bank">Bank</option><option value="other">Other</option>
            </select></div>
        </div>
        <div><label className="label">Note</label>
          <textarea name="note" defaultValue={p.note ?? ''} className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/payments" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
