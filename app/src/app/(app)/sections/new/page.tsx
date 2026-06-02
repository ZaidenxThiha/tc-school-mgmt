import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import { reqId } from '@/lib/form';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);
  const cap = formData.get('capacity');
  await sql`insert into sections (level_id, time_slot, is_online, capacity)
    values (${reqId(formData, 'level_id')}, ${String(formData.get('time_slot') ?? '').trim()},
            ${formData.get('is_online') === 'on'}, ${cap ? Number(cap) : null})`;
  revalidateTag('reference'); // refresh cached sections list
  redirect('/sections');
}

export default async function NewSection() {
  const levels = (await sql`select id, name from levels order by display_order`) as unknown as { id: number; name: string }[];
  return (
    <div className="page-narrow">
      <PageHeader title="Add section" />
      <form action={create} className="card space-y-4">
        <div><label className="label">Level</label>
          <select name="level_id" required className="input">
            {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></div>
        <div><label className="label">Time slot</label>
          <input name="time_slot" required className="input" placeholder="10-12" /></div>
        <div><label className="label inline-flex items-center gap-2">
          <input name="is_online" type="checkbox" /> Online</label></div>
        <div><label className="label">Capacity</label>
          <input name="capacity" type="number" min="0" className="input" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/sections" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
