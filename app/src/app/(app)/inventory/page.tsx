import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { mmk } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';


export default async function InventoryPage({
  searchParams,
}: { searchParams: Promise<{ kind?: string; q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const kind = sp.kind ?? 'all';
  const q    = sp.q    ?? '';
  const { page, pageSize, from, to } = parsePage(sp, 50);

  const supabase = await createClient();
  let query = supabase
    .from('products')
    .select('id, kind, name, level_id, size, cost_price, retail_price, level:levels(name)', { count: 'exact' })
    .order('kind').order('name');
  if (kind !== 'all') query = query.eq('kind', kind);
  if (q) query = query.ilike('name', `%${q}%`);

  const [{ data: products, count }, { data: stock }] = await Promise.all([
    query.range(from, to),
    supabase.from('v_product_stock').select('product_id, on_hand'),
  ]);
  const stockMap = new Map<number, number>((stock ?? []).map((r) => [r.product_id as number, Number(r.on_hand ?? 0)]));

  return (
    <div className="page">
      <PageHeader title="Inventory" subtitle={`${(count ?? 0).toLocaleString('en-US')} matching products`}
        actions={<Link href="/inventory/new" className="btn-primary">+ Add product</Link>} />
      <form className="flex gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Search name…" className="input max-w-sm" />
        <select name="kind" defaultValue={kind} className="input max-w-[160px]">
          <option value="all">All kinds</option>
          <option value="textbook">Textbook</option>
          <option value="tshirt">T-Shirt</option>
          <option value="id_card">ID Card</option>
          <option value="accessory">Accessory</option>
          <option value="other">Other</option>
        </select>
        <button className="btn-ghost">Filter</button>
        {(q || kind !== 'all') && <a href="/inventory" className="btn-ghost">Clear</a>}
      </form>
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>#</th><th>Kind</th><th>Name</th><th>Level</th><th>Size</th><th className="text-right">Cost</th><th className="text-right">Retail</th><th className="text-right">On hand</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {(products ?? []).map((p) => {
                const lvl = p.level as unknown as { name: string } | null;
                const del = deleteRow.bind(null, 'products', p.id, '/inventory');
                return (
                  <tr key={p.id}>
                    <td className="text-slate-400">{p.id}</td>
                    <td><span className="badge-slate">{p.kind}</span></td>
                    <td>{p.name}</td>
                    <td>{lvl?.name ?? '—'}</td>
                    <td>{p.size ?? '—'}</td>
                    <td className="tabular-nums">{mmk(p.cost_price)}</td>
                    <td className="tabular-nums">{mmk(p.retail_price)}</td>
                    <td className="text-right tabular-nums">{stockMap.get(p.id) ?? 0}</td>
                    <td className="text-right">
                      <Link href={`/inventory/${p.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <DeleteButton action={del} />
                    </td>
                  </tr>
                );
              })}
              {(products?.length ?? 0) === 0 && (
                <tr><td colSpan={9} className="text-slate-500 text-sm py-6 text-center">No products.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/inventory" query={{ q, kind }} />
      </div>
    </div>
  );
}
