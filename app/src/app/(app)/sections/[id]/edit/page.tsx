import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const cap = formData.get('capacity');
  const { error } = await supabase.from('sections').update({
    level_id: Number(formData.get('level_id')),
    time_slot: String(formData.get('time_slot') ?? '').trim(),
    is_online: formData.get('is_online') === 'on',
    capacity: cap ? Number(cap) : null,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  redirect('/sections');
}

export default async function EditSection({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const supabase = await createClient();
  const [{ data: s }, { data: levels }] = await Promise.all([
    supabase.from('sections').select('*').eq('id', id).single(),
    supabase.from('levels').select('id, name').order('display_order'),
  ]);
  if (!s) notFound();
  const action = save.bind(null, id);
  return (
    <div className="page-narrow">
      <PageHeader title={`Edit section #${id}`} />
      <form action={action} className="card space-y-4">
        <div><label className="label">Level</label>
          <select name="level_id" required defaultValue={s.level_id} className="input">
            {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></div>
        <div><label className="label">Time slot</label>
          <input name="time_slot" required defaultValue={s.time_slot} className="input" /></div>
        <div><label className="label inline-flex items-center gap-2">
          <input name="is_online" type="checkbox" defaultChecked={s.is_online} /> Online</label></div>
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
