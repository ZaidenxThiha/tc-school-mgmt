import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  const lvl = formData.get('level_id');
  await sql`update products set
    kind = ${String(formData.get('kind'))},
    name = ${String(formData.get('name') ?? '').trim()},
    level_id = ${lvl ? Number(lvl) : null},
    size = ${String(formData.get('size') ?? '').trim() || null},
    cost_price = ${Number(formData.get('cost_price') ?? 0) || null},
    retail_price = ${Number(formData.get('retail_price') ?? 0) || null},
    is_active = ${formData.get('is_active') === 'on'}
    where id = ${id}`;
  redirect('/inventory');
}

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [pRows, levels] = await Promise.all([
    sql`select * from products where id = ${id}`,
    sql`select id, name from levels order by display_order`,
  ]) as unknown as [
    Array<{ id: number; kind: string; name: string; level_id: number | null; size: string | null;
      cost_price: number | null; retail_price: number | null; is_active: boolean }>,
    { id: number; name: string }[],
  ];
  const p = pRows[0];
  if (!p) notFound();
  const action = save.bind(null, id);
  return (
    <div className="page-narrow">
      <PageHeader title={`Edit product #${id}`} subtitle={p.name} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Kind</label>
            <select name="kind" defaultValue={p.kind} required className="input">
              <option value="textbook">Textbook</option><option value="tshirt">T-Shirt</option>
              <option value="id_card">ID Card</option><option value="accessory">Accessory</option>
              <option value="other">Other</option>
            </select></div>
          <div><label className="label">Level</label>
            <select name="level_id" defaultValue={p.level_id ?? ''} className="input"><option value="">—</option>
              {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div className="col-span-2"><label className="label">Name</label>
            <input name="name" required defaultValue={p.name} className="input" /></div>
          <div><label className="label">Size</label>
            <input name="size" defaultValue={p.size ?? ''} className="input" /></div>
          <div><label className="label">Cost</label>
            <input name="cost_price" type="number" defaultValue={p.cost_price ?? ''} className="input" /></div>
          <div><label className="label">Retail</label>
            <input name="retail_price" type="number" defaultValue={p.retail_price ?? ''} className="input" /></div>
          <div className="col-span-2"><label className="label inline-flex items-center gap-2">
            <input name="is_active" type="checkbox" defaultChecked={p.is_active} /> Active</label></div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/inventory" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
