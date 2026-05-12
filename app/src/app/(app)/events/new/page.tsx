import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('events').insert({
    name: String(formData.get('name') ?? '').trim(),
    event_date: String(formData.get('event_date') ?? '') || null,
    budget: Number(formData.get('budget') ?? 0) || null,
    actual_cost: Number(formData.get('actual_cost') ?? 0) || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  });
  if (error) throw new Error(error.message);
  redirect('/events');
}

export default function NewEvent() {
  return (
    <div className="page-narrow">
      <PageHeader title="Add event" />
      <form action={create} className="card space-y-4">
        <div><label className="label">Name</label>
          <input name="name" required className="input" /></div>
        <div className="form-grid-2">
          <div><label className="label">Date</label>
            <input name="event_date" type="date" className="input" /></div>
          <div></div>
          <div><label className="label">Budget (MMK)</label>
            <input name="budget" type="number" min="0" className="input" /></div>
          <div><label className="label">Actual (MMK)</label>
            <input name="actual_cost" type="number" min="0" className="input" /></div>
        </div>
        <div><label className="label">Notes</label>
          <textarea name="notes" className="input min-h-[60px]" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/events" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
