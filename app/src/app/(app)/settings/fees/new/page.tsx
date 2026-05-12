import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('fee_schedule').insert({
    level_id: Number(formData.get('level_id')),
    effective_from: String(formData.get('effective_from') ?? ''),
    effective_to:   String(formData.get('effective_to') ?? '') || null,
    class_fee:    Number(formData.get('class_fee') ?? 0),
    textbook_fee: Number(formData.get('textbook_fee') ?? 0),
    tshirt_fee:   Number(formData.get('tshirt_fee') ?? 0),
    id_card_fee:  Number(formData.get('id_card_fee') ?? 0),
    guide_fee:    Number(formData.get('guide_fee') ?? 0),
    default_discount: Number(formData.get('default_discount') ?? 0),
    notes: String(formData.get('notes') ?? '').trim() || null,
  });
  if (error) throw new Error(error.message);
  redirect('/settings');
}

export default async function NewFee() {
  const supabase = await createClient();
  const { data: levels } = await supabase.from('levels').select('id, name').order('display_order');
  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title="Add fee row" subtitle="Multi-period price book" />
      <form action={create} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Level</label>
            <select name="level_id" required className="input">
              {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div></div>
          <div><label className="label">Effective from</label>
            <input name="effective_from" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className="input" /></div>
          <div><label className="label">Effective to (optional)</label>
            <input name="effective_to" type="date" className="input" /></div>
          <div><label className="label">Class fee (MMK)</label>
            <input name="class_fee" type="number" required className="input" /></div>
          <div><label className="label">Textbook fee</label>
            <input name="textbook_fee" type="number" defaultValue={0} className="input" /></div>
          <div><label className="label">T-Shirt fee</label>
            <input name="tshirt_fee" type="number" defaultValue={0} className="input" /></div>
          <div><label className="label">ID Card fee</label>
            <input name="id_card_fee" type="number" defaultValue={0} className="input" /></div>
          <div><label className="label">Guide fee</label>
            <input name="guide_fee" type="number" defaultValue={0} className="input" /></div>
          <div><label className="label">Default discount</label>
            <input name="default_discount" type="number" defaultValue={0} className="input" /></div>
        </div>
        <div><label className="label">Notes</label>
          <textarea name="notes" className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/settings" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Add</button>
        </div>
      </form>
    </div>
  );
}
