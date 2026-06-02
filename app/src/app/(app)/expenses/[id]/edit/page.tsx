import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import { reqId, money } from '@/lib/form';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  const productId = formData.get('product_id') ? Number(formData.get('product_id')) : null;
  const qty = formData.get('qty') ? Number(formData.get('qty')) : null;
  const unit = formData.get('unit_price') ? Number(formData.get('unit_price')) : null;
  await sql`update ledger_entries set
    entry_date = ${String(formData.get('entry_date') ?? '')},
    description = ${String(formData.get('description') ?? '').trim() || null},
    account_id = ${reqId(formData, 'account_id')},
    income_cash = ${money(formData, 'income_cash')},
    income_kpay = ${money(formData, 'income_kpay')},
    expense_cash = ${money(formData, 'expense_cash')},
    expense_kpay = ${money(formData, 'expense_kpay')},
    product_id = ${productId}, qty = ${qty}, unit_price = ${unit}
    where id = ${id}`;
  redirect('/expenses');
}

export default async function EditExpense({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [eRows, accts, products] = await Promise.all([
    sql`select e.*, to_char(e.entry_date, 'YYYY-MM-DD') as entry_date,
          case when p.id is null then null else json_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'size', p.size) end as product
        from ledger_entries e left join products p on p.id = e.product_id where e.id = ${id}`,
    sql`select id, group_name, category from chart_of_accounts order by category, group_name`,
    sql`select id, kind, name, size from products where is_active = true order by kind, name`,
  ]) as unknown as [
    Array<Record<string, unknown> & { product: { id: number; name: string; kind: string; size: string | null } | null }>,
    { id: number; group_name: string; category: string }[],
    { id: number; kind: string; name: string; size: string | null }[],
  ];
  const e = eRows[0] as (Record<string, unknown> & {
    entry_date: string; description: string | null; account_id: number | null;
    income_cash: number; income_kpay: number; expense_cash: number; expense_kpay: number;
    product_id: number | null; qty: number | null; unit_price: number | null;
    product: { id: number; name: string; kind: string; size: string | null } | null;
  }) | undefined;
  if (!e) notFound();
  const action = save.bind(null, id);
  const linkedProduct = e.product;
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
