import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const lvl = formData.get('level_id');
  const { error } = await supabase.from('products').insert({
    kind: String(formData.get('kind')),
    name: String(formData.get('name') ?? '').trim(),
    level_id: lvl ? Number(lvl) : null,
    size: String(formData.get('size') ?? '').trim() || null,
    cost_price:  Number(formData.get('cost_price') ?? 0) || null,
    retail_price: Number(formData.get('retail_price') ?? 0) || null,
  });
  if (error) throw new Error(error.message);
  redirect('/inventory');
}

export default async function NewProduct() {
  const supabase = await createClient();
  const { data: levels } = await supabase.from('levels').select('id, name').order('display_order');
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
