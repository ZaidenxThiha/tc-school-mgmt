import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  const channel = String(formData.get('channel'));
  const kind = String(formData.get('kind'));
  const amt = Number(formData.get('amount') ?? 0);
  const productId = formData.get('product_id') ? Number(formData.get('product_id')) : null;
  const qty = formData.get('qty') ? Number(formData.get('qty')) : null;
  const unit = formData.get('unit_price') ? Number(formData.get('unit_price')) : null;

  await sql`insert into ledger_entries
    (entry_date, description, account_id, income_cash, income_kpay, expense_cash, expense_kpay, source, product_id, qty, unit_price)
    values (
      ${String(formData.get('entry_date') ?? new Date().toISOString().slice(0,10))},
      ${String(formData.get('description') ?? '').trim() || null},
      ${Number(formData.get('account_id'))},
      ${kind === 'income' && channel === 'cash' ? amt : 0},
      ${kind === 'income' && channel === 'kpay' ? amt : 0},
      ${kind === 'expense' && channel === 'cash' ? amt : 0},
      ${kind === 'expense' && channel === 'kpay' ? amt : 0},
      'Manual', ${productId}, ${qty}, ${unit})`;
  redirect('/expenses');
}

export default async function NewExpense() {
  const [accts, products] = await Promise.all([
    sql`select id, group_name, category from chart_of_accounts order by category, group_name`,
    sql`select id, kind, name, size, cost_price from products where is_active = true order by kind, name`,
  ]) as unknown as [
    { id: number; group_name: string; category: string }[],
    { id: number; kind: string; name: string; size: string | null; cost_price: number | null }[],
  ];
  return (
    <div className="page-narrow">
      <PageHeader title="Add ledger entry" subtitle="Optionally link to inventory — qty will auto-add stock" />
      <form action={create} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Date</label>
            <input name="entry_date" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="input" /></div>
          <div><label className="label">Account</label>
            <select name="account_id" required className="input">
              {accts?.map((a) => <option key={a.id} value={a.id}>[{a.category}] {a.group_name}</option>)}
            </select></div>
          <div><label className="label">Type</label>
            <select name="kind" defaultValue="expense" className="input">
              <option value="expense">Expense</option><option value="income">Income</option>
            </select></div>
          <div><label className="label">Channel</label>
            <select name="channel" defaultValue="cash" className="input">
              <option value="cash">Cash</option><option value="kpay">KPay</option>
            </select></div>
          <div className="col-span-2"><label className="label">Amount (MMK)</label>
            <input name="amount" type="number" min="0" required className="input" /></div>
        </div>
        <div><label className="label">Description</label>
          <textarea name="description" required className="input min-h-[60px]" placeholder="e.g. Kuu Kuu textbook order" /></div>

        <details className="border-t pt-3 group">
          <summary className="cursor-pointer text-sm font-medium text-brand-600 hover:text-brand-700">
            📦 Link to inventory (optional)
          </summary>
          <div className="mt-3 form-grid-2 text-sm">
            <div className="col-span-2 text-xs text-slate-500 -mb-2">
              Pick a product + qty. The system auto-adds an inventory IN movement so stock updates immediately.
            </div>
            <div className="col-span-2"><label className="label">Product</label>
              <select name="product_id" defaultValue="" className="input">
                <option value="">— none —</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.kind}] {p.name}{p.size ? ` (${p.size})` : ''}
                  </option>
                ))}
              </select></div>
            <div><label className="label">Qty</label>
              <input name="qty" type="number" step="0.01" min="0" placeholder="e.g. 10" className="input" /></div>
            <div><label className="label">Unit price (MMK)</label>
              <input name="unit_price" type="number" min="0" placeholder="defaults to amount/qty" className="input" /></div>
            <div className="col-span-2 text-xs text-slate-400">
              No suitable product? <a href="/inventory/new" className="text-brand-600 hover:underline">Add one first →</a>
            </div>
          </div>
        </details>

        <div className="flex gap-2 justify-end pt-2">
          <a href="/expenses" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Add</button>
        </div>
      </form>
    </div>
  );
}
