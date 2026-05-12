import Link from 'next/link';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import { SLOTS, DAYS, type Cell } from './types';

type Room = { id: number; name: string; display_name: string | null };

export default function RoomGrid({
  rooms,
  byRoom,
  monthStr,
}: {
  rooms: Room[];
  byRoom: Map<number | null, Map<string, Cell[]>>;
  monthStr: string;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-auto max-h-[75vh]">
        <table className="text-xs w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 top-0 bg-slate-50 z-20 px-3 py-2 text-left font-medium text-slate-500 uppercase whitespace-nowrap border-b border-r">Room</th>
              {SLOTS.flatMap((slot) =>
                DAYS.map((day) => (
                  <th key={`${slot}-${day}`} className="sticky top-0 bg-slate-50 z-10 px-2 py-2 text-left font-medium text-slate-500 uppercase whitespace-nowrap border-b border-l">
                    <div>{slot}</div>
                    <div className="text-[10px] normal-case text-slate-400">{day === 'Sat' ? 'Sat (4-skills)' : 'Sun (R/W/G/P)'}</div>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="sticky left-0 bg-white z-10 px-3 py-2 font-medium border-b border-r min-w-[100px]">
                  <div>{r.name}</div>
                  <div className="text-[10px] text-slate-500">{r.display_name ?? '—'}</div>
                </td>
                {SLOTS.flatMap((slot) =>
                  DAYS.map((day) => {
                    const cells = byRoom.get(r.id)?.get(`${day}|${slot}`) ?? [];
                    return (
                      <td key={`${r.id}-${slot}-${day}`} className="px-2 py-2 border-b border-l align-top min-w-[150px] group">
                        {cells.length === 0 && (
                          <Link
                            href={`/schedule/new?month=${monthStr}&room=${r.id}&day=${day}&slot=${encodeURIComponent(slot)}`}
                            className="text-slate-300 hover:text-brand-600 text-xs inline-block w-full text-center py-1 border border-dashed border-slate-200 hover:border-brand-300 rounded"
                          >+ Add</Link>
                        )}
                        {cells.map((c) => {
                          const del = deleteRow.bind(null, 'schedule_assignments', c.id, `/schedule?month=${monthStr}`);
                          return (
                            <div key={c.id} className="mb-1.5 last:mb-0 group/cell">
                              {c.class_label && <div className="font-medium text-slate-900">{c.class_label}</div>}
                              {c.subject && <div className="text-[10px] text-slate-500">{c.subject}</div>}
                              {c.mt && <div className="text-emerald-700">MT: <Link href={`/employees/${c.mt.id}`} className="hover:underline">{c.mt.short_name}</Link></div>}
                              {c.ct && <div className="text-amber-700">CT: <Link href={`/employees/${c.ct.id}`} className="hover:underline">{c.ct.short_name}</Link></div>}
                              <div className="flex gap-2 mt-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                <Link href={`/schedule/${c.id}/edit`} className="text-[10px] text-brand-600 hover:underline">Edit</Link>
                                <DeleteButton action={del} label="Delete" className="text-[10px] text-rose-600 hover:underline" />
                              </div>
                            </div>
                          );
                        })}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr><td colSpan={9} className="text-slate-500 text-sm py-6 text-center">No rooms.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
