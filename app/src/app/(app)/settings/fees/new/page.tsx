import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import { reqId, money } from '@/lib/form';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);
  await sql`insert into fee_schedule
    (level_id, effective_from, effective_to, class_fee, textbook_fee, tshirt_fee, id_card_fee, guide_fee, default_discount, notes)
    values (
      ${reqId(formData, 'level_id')},
      ${String(formData.get('effective_from') ?? '')},
      ${String(formData.get('effective_to') ?? '') || null},
      ${money(formData, 'class_fee')},
      ${money(formData, 'textbook_fee')},
      ${money(formData, 'tshirt_fee')},
      ${money(formData, 'id_card_fee')},
      ${money(formData, 'guide_fee')},
      ${money(formData, 'default_discount')},
      ${String(formData.get('notes') ?? '').trim() || null})`;
  redirect('/settings');
}

export default async function NewFee() {
  const levels = (await sql`select id, name from levels order by display_order`) as unknown as { id: number; name: string }[];
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
