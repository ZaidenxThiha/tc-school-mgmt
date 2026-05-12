import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('payments').insert({
    student_id: Number(formData.get('student_id')),
    paid_at: String(formData.get('paid_at') ?? new Date().toISOString()),
    amount: Number(formData.get('amount') ?? 0),
    channel: String(formData.get('channel') ?? 'cash'),
    note: String(formData.get('note') ?? '').trim() || null,
  });
  if (error) throw new Error(error.message);
  redirect('/payments');
}

export default async function NewPayment() {
  const supabase = await createClient();
  const { data: students } = await supabase
    .from('students')
    .select('id, english_name, myanmar_name')
    .eq('current_status', 'Active')
    .order('english_name')
    .limit(1000);
  return (
    <div className="page-narrow">
      <PageHeader title="Record payment" />
      <form action={create} className="card space-y-4">
        <div><label className="label">Student</label>
          <select name="student_id" required className="input">
            <option value="">— select —</option>
            {students?.map((s) => (
              <option key={s.id} value={s.id}>{s.english_name ?? s.myanmar_name} #{s.id}</option>
            ))}
          </select></div>
        <div className="form-grid-2">
          <div><label className="label">Date</label>
            <input name="paid_at" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="input" /></div>
          <div><label className="label">Amount (MMK)</label>
            <input name="amount" type="number" min="0" required className="input" /></div>
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
          <button type="submit" className="btn-primary">Record</button>
        </div>
      </form>
    </div>
  );
}
