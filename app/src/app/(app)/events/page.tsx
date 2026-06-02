import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import { mmk, shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';


export default async function EventsPage() {
  const events = (await sql`
    select id, name, to_char(event_date, 'YYYY-MM-DD') as event_date, budget, actual_cost
    from events order by event_date desc
  `) as unknown as { id: number; name: string; event_date: string | null; budget: number | null; actual_cost: number | null }[];
  return (
    <div className="page">
      <PageHeader title="Events" subtitle="Budget vs actual"
        actions={<Link href="/events/new" className="btn-primary">+ Add event</Link>} />
      <div className="card p-0 overflow-hidden">
        <table className="table">
          <thead><tr><th>#</th><th>Name</th><th>Date</th><th className="text-right">Budget</th><th className="text-right">Actual</th><th className="text-right">Variance</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {(events ?? []).map((e) => {
              const variance = Number(e.actual_cost ?? 0) - Number(e.budget ?? 0);
              const del = deleteRow.bind(null, 'events', e.id, '/events');
              return (
                <tr key={e.id}>
                  <td className="text-slate-400">{e.id}</td>
                  <td><Link href={`/events/${e.id}`} className="text-brand-600 hover:underline">{e.name}</Link></td>
                  <td>{shortDate(e.event_date)}</td>
                  <td className="tabular-nums">{mmk(e.budget)}</td>
                  <td className="tabular-nums">{mmk(e.actual_cost)}</td>
                  <td className={`tabular-nums ${variance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{mmk(variance)}</td>
                  <td className="text-right">
                    <Link href={`/events/${e.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                    <DeleteButton action={del} />
                  </td>
                </tr>
              );
            })}
            {(events?.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No events.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
