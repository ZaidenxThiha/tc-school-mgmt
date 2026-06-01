import { notFound, redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);
  const cap = formData.get('capacity');
  await sql`update sections set
      level_id = ${Number(formData.get('level_id'))},
      time_slot = ${String(formData.get('time_slot') ?? '').trim()},
      is_online = ${formData.get('is_online') === 'on'},
      capacity = ${cap ? Number(cap) : null}
    where id = ${id}`;
  revalidateTag('reference');
  redirect('/sections');
}

export default async function EditSection({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [secRows, levels] = await Promise.all([
    sql`select level_id, time_slot, is_online, capacity from sections where id = ${id}`,
    sql`select id, name from levels order by display_order`,
  ]);
  const s = secRows[0] as unknown as { level_id: number; time_slot: string; is_online: boolean | null; capacity: number | null } | undefined;
  if (!s) notFound();
  const action = save.bind(null, id);
  return (
    <div className="page-narrow">
      <PageHeader title={`Edit section #${id}`} />
      <form action={action} className="card space-y-4">
        <div><label className="label">Level</label>
          <select name="level_id" required defaultValue={s.level_id} className="input">
            {(levels as unknown as { id: number; name: string }[]).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></div>
        <div><label className="label">Time slot</label>
          <input name="time_slot" required defaultValue={s.time_slot} className="input" /></div>
        <div><label className="label inline-flex items-center gap-2">
          <input name="is_online" type="checkbox" defaultChecked={s.is_online ?? false} /> Online</label></div>
        <div><label className="label">Capacity</label>
          <input name="capacity" type="number" defaultValue={s.capacity ?? ''} className="input" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/sections" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
