import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';
import { mmk, shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';


async function addItem(eventId: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  await sql`insert into event_budget_items (event_id, item, qty, unit_price, amount, supplier_name, is_estimate) values (
    ${eventId},
    ${String(formData.get('item') ?? '').trim()},
    ${Number(formData.get('qty') ?? 0) || null},
    ${Number(formData.get('unit_price') ?? 0) || null},
    ${Number(formData.get('amount') ?? 0) || null},
    ${String(formData.get('supplier_name') ?? '').trim() || null},
    ${formData.get('is_estimate') === 'on'})`;
  redirect(`/events/${eventId}`);
}

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [evRows, items] = await Promise.all([
    sql`select id, name, to_char(event_date, 'YYYY-MM-DD') as event_date, budget, actual_cost from events where id = ${id}`,
    sql`select * from event_budget_items where event_id = ${id} order by id`,
  ]) as unknown as [
    { id: number; name: string; event_date: string | null; budget: number | null; actual_cost: number | null }[],
    Array<{ id: number; item: string; qty: number | null; unit_price: number | null; amount: number | null; supplier_name: string | null; is_estimate: boolean }>,
  ];
  const ev = evRows[0];
  if (!ev) notFound();
  const action = addItem.bind(null, id);
  const totalEstimated = (items ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
  return (
    <div className="page">
      <PageHeader title={ev.name} subtitle={shortDate(ev.event_date)}
        actions={<Link href={`/events/${id}/edit`} className="btn-ghost">Edit event</Link>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="card"><div className="text-xs uppercase text-slate-500">Budget</div>
          <div className="text-xl font-semibold">{mmk(ev.budget)}</div></div>
        <div className="card"><div className="text-xs uppercase text-slate-500">Actual cost</div>
          <div className="text-xl font-semibold">{mmk(ev.actual_cost)}</div></div>
        <div className="card"><div className="text-xs uppercase text-slate-500">Items total</div>
          <div className="text-xl font-semibold">{mmk(totalEstimated)}</div></div>
      </div>
      <div className="card p-0 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b font-medium">Budget items ({items?.length ?? 0})</div>
        <table className="table">
          <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Amount</th><th>Supplier</th><th></th><th className="text-right"></th></tr></thead>
          <tbody>
            {(items ?? []).map((i) => {
              const del = deleteRow.bind(null, 'event_budget_items', i.id, `/events/${id}`);
              return (
                <tr key={i.id}>
                  <td>{i.item}</td>
                  <td>{i.qty ?? '—'}</td>
                  <td className="tabular-nums">{mmk(i.unit_price)}</td>
                  <td className="tabular-nums">{mmk(i.amount)}</td>
                  <td>{i.supplier_name ?? '—'}</td>
                  <td>{i.is_estimate ? <span className="badge-amber">est</span> : <span className="badge-green">actual</span>}</td>
                  <td className="text-right"><DeleteButton action={del} /></td>
                </tr>
              );
            })}
            {(items?.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="text-slate-500 text-sm py-4 text-center">No items.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="font-medium mb-3">Add budget item</div>
        <form action={action} className="grid grid-cols-2 gap-3 text-sm">
          <input name="item" required placeholder="Item" className="input col-span-2" />
          <input name="qty" type="number" step="0.01" placeholder="Qty" className="input" />
          <input name="unit_price" type="number" placeholder="Unit price" className="input" />
          <input name="amount" type="number" placeholder="Amount (total)" className="input" />
          <input name="supplier_name" placeholder="Supplier" className="input" />
          <label className="label inline-flex items-center gap-2 col-span-2">
            <input name="is_estimate" type="checkbox" defaultChecked /> Estimate (uncheck for actual)</label>
          <button type="submit" className="btn-primary col-span-2">Add item</button>
        </form>
      </div>
    </div>
  );
}
