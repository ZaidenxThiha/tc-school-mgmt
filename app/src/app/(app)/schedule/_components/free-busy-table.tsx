import { SLOTS, DAYS, type Employee, type ByTeacher } from './types';

export default function FreeBusyTable({
  employees,
  byTeacher,
  monthStr,
}: {
  employees: Employee[];
  byTeacher: ByTeacher;
  monthStr: string;
}) {
  const teachers = employees
    .filter((e) => byTeacher.has(e.id) || ['esl_teacher', 'admin_teacher'].includes(e.category))
    .sort((a, b) => a.short_name.localeCompare(b.short_name));

  function cellAt(empId: number, day: string, slot: string) {
    return byTeacher.get(empId)?.find((c) => c.day === day && c.slot === slot) ?? null;
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="overflow-auto max-h-[78vh]">
        <table className="text-xs w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="sticky left-0 top-0 bg-slate-50 z-20 px-3 py-2 text-left font-medium text-slate-500 uppercase whitespace-nowrap border-b border-r min-w-[140px]">Teacher</th>
              {SLOTS.flatMap((slot) =>
                DAYS.map((day) => (
                  <th key={`${slot}-${day}`} className="sticky top-0 bg-slate-50 z-10 px-2 py-2 text-left font-medium text-slate-500 uppercase whitespace-nowrap border-b border-l min-w-[140px]">
                    <div>{slot}</div>
                    <div className="text-[10px] normal-case text-slate-400">{day === 'Sat' ? 'Sat (4-skills)' : 'Sun (R/W/G/P)'}</div>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {teachers.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="sticky left-0 bg-white z-10 px-3 py-2 font-medium border-b border-r">
                  <a href={`/schedule?month=${monthStr}&view=teacher&teacher=${e.id}`} className="text-brand-600 hover:underline">{e.short_name}</a>
                </td>
                {SLOTS.flatMap((slot) =>
                  DAYS.map((day) => {
                    const c = cellAt(e.id, day, slot);
                    if (!c) {
                      return (
                        <td key={`${slot}-${day}`} className="px-2 py-2 border-b border-l align-top">
                          <span className="text-emerald-700 font-semibold">Free</span>
                        </td>
                      );
                    }
                    return (
                      <td key={`${slot}-${day}`} className="px-2 py-2 border-b border-l align-top">
                        <div className={c.role === 'MT' ? 'text-emerald-700' : 'text-amber-700'}>
                          <span className="font-semibold">{c.role}</span> – {c.class ?? '—'}
                        </div>
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr><td colSpan={9} className="text-slate-500 text-center py-6">No teachers.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
