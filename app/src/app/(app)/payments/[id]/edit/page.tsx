import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('payments').update({
    paid_at: String(formData.get('paid_at') ?? ''),
    amount: Number(formData.get('amount') ?? 0),
    channel: String(formData.get('channel') ?? 'cash'),
    note: String(formData.get('note') ?? '').trim() || null,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  redirect('/payments');
}

export default async function EditPayment({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const supabase = await createClient();
  const { data: p } = await supabase.from('payments').select('*, student:students(english_name, myanmar_name)').eq('id', id).single();
  if (!p) notFound();
  const action = save.bind(null, id);
  const s = p.student as unknown as { english_name?: string; myanmar_name?: string } | null;
  return (
    <div className="page-narrow">
      <PageHeader title={`Edit payment #${id}`} subtitle={s?.english_name ?? s?.myanmar_name ?? ''} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Date</label>
            <input name="paid_at" type="date" required defaultValue={p.paid_at?.slice(0,10) ?? ''} className="input" /></div>
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
