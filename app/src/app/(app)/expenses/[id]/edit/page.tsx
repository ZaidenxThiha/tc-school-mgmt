import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const productId = formData.get('product_id') ? Number(formData.get('product_id')) : null;
  const qty = formData.get('qty') ? Number(formData.get('qty')) : null;
  const unit = formData.get('unit_price') ? Number(formData.get('unit_price')) : null;
  const { error } = await supabase.from('ledger_entries').update({
    entry_date: String(formData.get('entry_date') ?? ''),
    description: String(formData.get('description') ?? '').trim() || null,
    account_id: Number(formData.get('account_id')),
    income_cash:  Number(formData.get('income_cash') ?? 0),
    income_kpay:  Number(formData.get('income_kpay') ?? 0),
    expense_cash: Number(formData.get('expense_cash') ?? 0),
    expense_kpay: Number(formData.get('expense_kpay') ?? 0),
    product_id: productId,
    qty, unit_price: unit,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  redirect('/expenses');
}

export default async function EditExpense({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const supabase = await createClient();
  const [{ data: e }, { data: accts }, { data: products }] = await Promise.all([
    supabase.from('ledger_entries').select('*, product:products(id, name, kind, size)').eq('id', id).single(),
    supabase.from('chart_of_accounts').select('id, group_name, category').order('category').order('group_name'),
    supabase.from('products').select('id, kind, name, size').eq('is_active', true).order('kind').order('name'),
  ]);
  if (!e) notFound();
  const action = save.bind(null, id);
  const linkedProduct = e.product as unknown as { id: number; name: string; kind: string; size: string | null } | null;
  return (
    <div className="page-narrow">
      <PageHeader title={`Edit ledger entry #${id}`} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Date</label>
            <input name="entry_date" type="date" required defaultValue={e.entry_date} className="input" /></div>
          <div><label className="label">Account</label>
            <select name="account_id" required defaultValue={e.account_id ?? ''} className="input">
              {accts?.map((a) => <option key={a.id} value={a.id}>[{a.category}] {a.group_name}</option>)}
            </select></div>
          <div><label className="label">Income (cash)</label>
            <input name="income_cash" type="number" defaultValue={e.income_cash ?? 0} className="input" /></div>
          <div><label className="label">Income (KPay)</label>
            <input name="income_kpay" type="number" defaultValue={e.income_kpay ?? 0} className="input" /></div>
          <div><label className="label">Expense (cash)</label>
            <input name="expense_cash" type="number" defaultValue={e.expense_cash ?? 0} className="input" /></div>
          <div><label className="label">Expense (KPay)</label>
            <input name="expense_kpay" type="number" defaultValue={e.expense_kpay ?? 0} className="input" /></div>
        </div>
        <div><label className="label">Description</label>
          <textarea name="description" defaultValue={e.description ?? ''} className="input min-h-[60px]" /></div>

        <details open={!!e.product_id} className="border-t pt-3">
          <summary className="cursor-pointer text-sm font-medium text-brand-600 hover:text-brand-700">
            📦 Inventory link {linkedProduct ? `· currently: ${linkedProduct.name}` : ''}
          </summary>
          <div className="mt-3 form-grid-2 text-sm">
            <div className="col-span-2 text-xs text-slate-500 -mb-2">
              Changing the product/qty here updates the matching inventory IN movement automatically.
            </div>
            <div className="col-span-2"><label className="label">Product</label>
              <select name="product_id" defaultValue={e.product_id ?? ''} className="input">
                <option value="">— none —</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.kind}] {p.name}{p.size ? ` (${p.size})` : ''}
                  </option>
                ))}
              </select></div>
            <div><label className="label">Qty</label>
              <input name="qty" type="number" step="0.01" min="0" defaultValue={e.qty ?? ''} className="input" /></div>
            <div><label className="label">Unit price</label>
              <input name="unit_price" type="number" min="0" defaultValue={e.unit_price ?? ''} className="input" /></div>
          </div>
        </details>

        <div className="flex gap-2 justify-end pt-2">
          <a href="/expenses" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
