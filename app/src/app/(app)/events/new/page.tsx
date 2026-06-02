import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);
  await sql`insert into events (name, event_date, budget, actual_cost, notes) values (
    ${String(formData.get('name') ?? '').trim()},
    ${String(formData.get('event_date') ?? '') || null},
    ${Number(formData.get('budget') ?? 0) || null},
    ${Number(formData.get('actual_cost') ?? 0) || null},
    ${String(formData.get('notes') ?? '').trim() || null})`;
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
