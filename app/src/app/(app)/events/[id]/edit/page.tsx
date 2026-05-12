import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('events').update({
    name: String(formData.get('name') ?? '').trim(),
    event_date: String(formData.get('event_date') ?? '') || null,
    budget: Number(formData.get('budget') ?? 0) || null,
    actual_cost: Number(formData.get('actual_cost') ?? 0) || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  redirect(`/events/${id}`);
}

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const supabase = await createClient();
  const { data: e } = await supabase.from('events').select('*').eq('id', id).single();
  if (!e) notFound();
  const action = save.bind(null, id);
  return (
    <div className="page-narrow">
      <PageHeader title={`Edit ${e.name}`} />
      <form action={action} className="card space-y-4">
        <div><label className="label">Name</label>
          <input name="name" required defaultValue={e.name} className="input" /></div>
        <div className="form-grid-2">
          <div><label className="label">Date</label>
            <input name="event_date" type="date" defaultValue={e.event_date ?? ''} className="input" /></div>
          <div></div>
          <div><label className="label">Budget (MMK)</label>
            <input name="budget" type="number" defaultValue={e.budget ?? ''} className="input" /></div>
          <div><label className="label">Actual (MMK)</label>
            <input name="actual_cost" type="number" defaultValue={e.actual_cost ?? ''} className="input" /></div>
        </div>
        <div><label className="label">Notes</label>
          <textarea name="notes" defaultValue={e.notes ?? ''} className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href={`/events/${id}`} className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
