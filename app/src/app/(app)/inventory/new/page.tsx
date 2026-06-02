import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  const lvl = formData.get('level_id');
  await sql`insert into products (kind, name, level_id, size, cost_price, retail_price) values (
    ${String(formData.get('kind'))},
    ${String(formData.get('name') ?? '').trim()},
    ${lvl ? Number(lvl) : null},
    ${String(formData.get('size') ?? '').trim() || null},
    ${Number(formData.get('cost_price') ?? 0) || null},
    ${Number(formData.get('retail_price') ?? 0) || null})`;
  redirect('/inventory');
}

export default async function NewProduct() {
  const levels = (await sql`select id, name from levels order by display_order`) as unknown as { id: number; name: string }[];
  return (
    <div className="page-narrow">
      <PageHeader title="Add product" />
      <form action={create} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Kind</label>
            <select name="kind" defaultValue="textbook" required className="input">
              <option value="textbook">Textbook</option><option value="tshirt">T-Shirt</option>
              <option value="id_card">ID Card</option><option value="accessory">Accessory</option>
              <option value="other">Other</option>
            </select></div>
          <div><label className="label">Level (optional)</label>
            <select name="level_id" className="input"><option value="">—</option>
              {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div className="col-span-2"><label className="label">Name</label>
            <input name="name" required className="input" /></div>
          <div><label className="label">Size</label>
            <input name="size" className="input" /></div>
          <div><label className="label">Cost</label>
            <input name="cost_price" type="number" min="0" className="input" /></div>
          <div><label className="label">Retail</label>
            <input name="retail_price" type="number" min="0" className="input" /></div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/inventory" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
