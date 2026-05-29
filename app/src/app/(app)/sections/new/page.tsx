import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const cap = formData.get('capacity');
  const { error } = await supabase.from('sections').insert({
    level_id: Number(formData.get('level_id')),
    time_slot: String(formData.get('time_slot') ?? '').trim(),
    is_online: formData.get('is_online') === 'on',
    capacity: cap ? Number(cap) : null,
  });
  if (error) throw new Error(error.message);
  revalidateTag('reference'); // refresh cached sections list
  redirect('/sections');
}

export default async function NewSection() {
  const supabase = await createClient();
  const { data: levels } = await supabase.from('levels').select('id, name').order('display_order');
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
