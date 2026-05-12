import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { mmk, monthLabel } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';


async function save(id: number, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('invoices').update({
    total_amount: Number(formData.get('total_amount') ?? 0),
    discount: Number(formData.get('discount') ?? 0) || 0,
    fine: Number(formData.get('fine') ?? 0) || 0,
    status: String(formData.get('status') ?? 'open'),
    is_new_student: formData.get('is_new_student') === 'on',
  }).eq('id', id);
  if (error) throw new Error(error.message);
  redirect('/billing');
}

async function addLine(invoiceId: number, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('invoice_lines').insert({
    invoice_id: invoiceId,
    kind: String(formData.get('kind') ?? 'other'),
    description: String(formData.get('description') ?? '').trim() || null,
    qty: Number(formData.get('qty') ?? 1),
    unit_price: Number(formData.get('unit_price') ?? 0) || null,
    amount: Number(formData.get('amount') ?? 0),
  });
  if (error) throw new Error(error.message);
  redirect(`/billing/${invoiceId}/edit`);
}

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const supabase = await createClient();
  const [{ data: inv }, { data: lines }, { data: payments }] = await Promise.all([
    supabase.from('invoices').select('*, student:students(id, english_name, myanmar_name), section:sections(time_slot, is_online, level:levels(name))').eq('id', id).single(),
    supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('id'),
    supabase.from('payments').select('id, paid_at, amount, channel').eq('invoice_id', id).order('paid_at'),
  ]);
  if (!inv) notFound();
  const action = save.bind(null, id);
  const lineAct = addLine.bind(null, id);
  const s = inv.student as unknown as { id: number; english_name: string | null; myanmar_name: string | null } | null;
  const sec = inv.section as unknown as { time_slot: string; is_online: boolean; level: { name: string } | null } | null;
  return (
    <div className="page-narrow max-w-3xl space-y-4">
      <PageHeader
        title={`Invoice #${id}`}
        subtitle={`${s?.english_name ?? s?.myanmar_name ?? '—'} · ${monthLabel(inv.billing_month)} · ${sec ? `${sec.level?.name} (${sec.time_slot})` : ''}`}
        actions={<a href={`/billing/${id}/receipt`} className="btn-ghost">View receipt</a>}
      />

      <form action={action} className="card space-y-3">
        <div className="text-xs font-semibold uppercase text-slate-500">Invoice</div>
        <div className="form-grid-2">
          <div><label className="label">Total amount</label>
            <input name="total_amount" type="number" required defaultValue={inv.total_amount ?? 0} className="input" /></div>
          <div><label className="label">Status</label>
            <select name="status" defaultValue={inv.status} className="input">
              <option value="open">Open</option><option value="partial">Partial</option>
              <option value="paid">Paid</option><option value="void">Void</option>
            </select></div>
          <div><label className="label">Discount</label>
            <input name="discount" type="number" defaultValue={inv.discount ?? 0} className="input" /></div>
          <div><label className="label">Fine</label>
            <input name="fine" type="number" defaultValue={inv.fine ?? 0} className="input" /></div>
          <div className="sm:col-span-2"><label className="label inline-flex items-center gap-2">
            <input name="is_new_student" type="checkbox" defaultChecked={inv.is_new_student} /> New-student utilities applied</label></div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/billing" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-medium text-sm">Invoice lines ({lines?.length ?? 0})</div>
        <table className="table">
          <thead><tr><th>Kind</th><th>Description</th><th>Qty</th><th>Unit</th><th className="text-right">Amount</th><th className="text-right"></th></tr></thead>
          <tbody>
            {(lines ?? []).map((l) => {
              const del = deleteRow.bind(null, 'invoice_lines', l.id, `/billing/${id}/edit`);
              return (
                <tr key={l.id}>
                  <td className="text-xs"><span className="badge-slate">{l.kind}</span></td>
                  <td className="text-xs">{l.description ?? '—'}</td>
                  <td className="text-xs tabular-nums">{l.qty ?? 1}</td>
                  <td className="text-xs tabular-nums">{mmk(l.unit_price)}</td>
                  <td className="text-right tabular-nums">{mmk(l.amount)}</td>
                  <td className="text-right"><DeleteButton action={del} /></td>
                </tr>
              );
            })}
            {(lines?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="text-slate-500 text-xs py-3 text-center">No lines.</td></tr>
            )}
          </tbody>
        </table>
        <form action={lineAct} className="p-3 border-t bg-slate-50">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <select name="kind" defaultValue="class_fee" className="input text-xs">
              <option>class_fee</option><option>book</option><option>id</option>
              <option>tshirt</option><option>guide</option>
              <option>fine</option><option>discount</option><option>other</option>
            </select>
            <input name="description" placeholder="Description" className="input text-xs" />
            <input name="qty" type="number" step="0.01" defaultValue={1} className="input text-xs" />
            <input name="unit_price" type="number" placeholder="Unit price" className="input text-xs" />
            <input name="amount" type="number" required placeholder="Amount" className="input text-xs" />
          </div>
          <button type="submit" className="btn-primary text-xs mt-2">Add line</button>
        </form>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-medium text-sm">Payments against this invoice ({payments?.length ?? 0})</div>
        <table className="table">
          <thead><tr><th>Date</th><th>Channel</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id}>
                <td className="text-xs">{p.paid_at?.slice(0,10)}</td>
                <td className="text-xs">{p.channel}</td>
                <td className="text-right tabular-nums">{mmk(p.amount)}</td>
              </tr>
            ))}
            {(payments?.length ?? 0) === 0 && (
              <tr><td colSpan={3} className="text-slate-500 text-xs py-3 text-center">No payments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
