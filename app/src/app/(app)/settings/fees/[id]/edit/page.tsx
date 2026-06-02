import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);
  await sql`update fee_schedule set
    level_id = ${Number(formData.get('level_id'))},
    effective_from = ${String(formData.get('effective_from') ?? '')},
    effective_to = ${String(formData.get('effective_to') ?? '') || null},
    class_fee = ${Number(formData.get('class_fee') ?? 0)},
    textbook_fee = ${Number(formData.get('textbook_fee') ?? 0)},
    tshirt_fee = ${Number(formData.get('tshirt_fee') ?? 0)},
    id_card_fee = ${Number(formData.get('id_card_fee') ?? 0)},
    guide_fee = ${Number(formData.get('guide_fee') ?? 0)},
    default_discount = ${Number(formData.get('default_discount') ?? 0)},
    notes = ${String(formData.get('notes') ?? '').trim() || null}
    where id = ${id}`;
  redirect('/settings');
}

export default async function EditFee({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [fRows, levels] = await Promise.all([
    sql`select *, to_char(effective_from, 'YYYY-MM-DD') as effective_from, to_char(effective_to, 'YYYY-MM-DD') as effective_to from fee_schedule where id = ${id}`,
    sql`select id, name from levels order by display_order`,
  ]) as unknown as [
    Array<{ id: number; level_id: number; effective_from: string; effective_to: string | null;
      class_fee: number; textbook_fee: number | null; tshirt_fee: number | null; id_card_fee: number | null;
      guide_fee: number | null; default_discount: number | null; notes: string | null }>,
    { id: number; name: string }[],
  ];
  const f = fRows[0];
  if (!f) notFound();
  const action = save.bind(null, id);
  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title={`Edit fee row #${id}`} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">Level</label>
            <select name="level_id" required defaultValue={f.level_id} className="input">
              {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div></div>
          <div><label className="label">Effective from</label>
            <input name="effective_from" type="date" required defaultValue={f.effective_from} className="input" /></div>
          <div><label className="label">Effective to</label>
            <input name="effective_to" type="date" defaultValue={f.effective_to ?? ''} className="input" /></div>
          <div><label className="label">Class fee</label>
            <input name="class_fee" type="number" required defaultValue={f.class_fee} className="input" /></div>
          <div><label className="label">Textbook fee</label>
            <input name="textbook_fee" type="number" defaultValue={f.textbook_fee ?? 0} className="input" /></div>
          <div><label className="label">T-Shirt fee</label>
            <input name="tshirt_fee" type="number" defaultValue={f.tshirt_fee ?? 0} className="input" /></div>
          <div><label className="label">ID Card fee</label>
            <input name="id_card_fee" type="number" defaultValue={f.id_card_fee ?? 0} className="input" /></div>
          <div><label className="label">Guide fee</label>
            <input name="guide_fee" type="number" defaultValue={f.guide_fee ?? 0} className="input" /></div>
          <div><label className="label">Default discount</label>
            <input name="default_discount" type="number" defaultValue={f.default_discount ?? 0} className="input" /></div>
        </div>
        <div><label className="label">Notes</label>
          <textarea name="notes" defaultValue={f.notes ?? ''} className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/settings" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
