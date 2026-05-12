import { SLOTS, DAYS, type Employee, type ByTeacher } from './types';

export default function TeacherView({
  employees,
  byTeacher,
  monthStr,
  monthLabel,
  selectedId,
}: {
  employees: Employee[];
  byTeacher: ByTeacher;
  monthStr: string;
  monthLabel: string;
  selectedId: number | null;
}) {
  const eligible = employees
    .filter((e) => byTeacher.has(e.id) || ['esl_teacher', 'admin_teacher'].includes(e.category))
    .sort((a, b) => a.short_name.localeCompare(b.short_name));

  const selected = selectedId
    ? eligible.find((e) => e.id === selectedId) ?? eligible[0] ?? null
    : eligible[0] ?? null;

  function cellFor(day: string, slot: string) {
    if (!selected) return null;
    return byTeacher.get(selected.id)?.find((s) => s.day === day && s.slot === slot) ?? null;
  }

  return (
    <div className="space-y-3">
      <form className="card flex items-center gap-2 flex-wrap" method="GET" action="/schedule">
        <input type="hidden" name="view" value="teacher" />
        <input type="hidden" name="month" value={monthStr} />
        <label className="text-xs text-slate-500 font-medium">Teacher</label>
        <select name="teacher" defaultValue={selected?.id ?? ''} className="input max-w-[260px]">
          {eligible.map((e) => (
            <option key={e.id} value={e.id}>{e.short_name}</option>
          ))}
          {eligible.length === 0 && <option value="">— no teachers —</option>}
        </select>
        <button className="btn-ghost text-xs">Show</button>
        {selected && (
          <a href={`/employees/${selected.id}`} className="text-xs text-brand-600 hover:underline ml-auto">
            View profile →
          </a>
        )}
      </form>

      {!selected ? (
        <div className="card text-center text-sm text-slate-500">No teachers to show for {monthLabel}.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-bold uppercase text-xs border-b border-r min-w-[100px]">DAY</th>
                  {SLOTS.map((slot) => (
                    <th key={slot} className="px-3 py-2 text-center font-bold text-xs border-b border-l min-w-[150px]">
                      {slot.replace('-', ' - ').replace(/(\d):(\d{2})/g, (_, h, m) => `${String(h).padStart(2, '0')}:${m}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day}>
                    <td className="px-3 py-3 font-bold uppercase text-xs border-b border-r bg-slate-50">
                      {day === 'Sat' ? 'SATURDAY' : 'SUNDAY'}
                    </td>
                    {SLOTS.map((slot) => {
                      const c = cellFor(day, slot);
                      if (!c) return (
                        <td key={slot} className="px-3 py-3 text-center text-slate-400 border-b border-l">-</td>
                      );
                      const tone = c.role === 'MT' ? 'text-emerald-800' : 'text-amber-800';
                      return (
                        <td key={slot} className={`px-3 py-3 border-b border-l text-sm ${tone}`}>
                          <span className="font-semibold">{c.role}</span> – {c.class ?? '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t text-xs text-slate-500 flex items-center gap-4 flex-wrap">
            {(() => {
              const slots = byTeacher.get(selected.id) ?? [];
              const mtN = slots.filter((s) => s.role === 'MT').length;
              const ctN = slots.filter((s) => s.role === 'CT').length;
              const freeN = (DAYS.length * SLOTS.length) - mtN - ctN;
              return (
                <>
                  <span className="text-emerald-700 font-medium">{mtN} MT</span>
                  <span className="text-amber-700 font-medium">{ctN} CT</span>
                  <span className="text-slate-500">{freeN} free slots</span>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
