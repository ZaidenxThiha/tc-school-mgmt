import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


async function save(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  await sql`update events set
    name = ${String(formData.get('name') ?? '').trim()},
    event_date = ${String(formData.get('event_date') ?? '') || null},
    budget = ${Number(formData.get('budget') ?? 0) || null},
    actual_cost = ${Number(formData.get('actual_cost') ?? 0) || null},
    notes = ${String(formData.get('notes') ?? '').trim() || null}
    where id = ${id}`;
  redirect(`/events/${id}`);
}

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const eRows = (await sql`select id, name, to_char(event_date, 'YYYY-MM-DD') as event_date, budget, actual_cost, notes from events where id = ${id}`) as unknown as { id: number; name: string; event_date: string | null; budget: number | null; actual_cost: number | null; notes: string | null }[];
  const e = eRows[0];
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
