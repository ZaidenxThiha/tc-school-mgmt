import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { copyFromPreviousMonth } from '@/lib/actions/schedule';
import RoomGrid from './_components/room-grid';
import TeacherView from './_components/teacher-view';
import FreeBusyTable from './_components/free-busy-table';
import type { Cell, ByTeacher, Employee, TeacherRef } from './_components/types';


type SearchParams = {
  month?: string;
  view?: string;
  teacher?: string;
  freeDay?: string;
  freeSlot?: string;
  copied?: string;
  from?: string;
};

export default async function SchedulePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthStr = (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) ? sp.month : defaultMonth;
  const monthIso = `${monthStr}-01`;
  const view = sp.view === 'teacher' ? 'teacher' : sp.view === 'free' ? 'free' : 'room';
  const teacherId = sp.teacher ? Number(sp.teacher) : null;
  const monthLabel = new Date(monthIso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const copiedCount = sp.copied ? Number(sp.copied) : null;
  const copiedFrom = sp.from || null;

  const supabase = await createClient();
  const [{ data: rooms }, { data: assignments }, { data: employees }] = await Promise.all([
    supabase.from('rooms').select('id, name, display_name').order('id'),
    supabase.from('schedule_assignments')
      .select(`
        id, day_of_week, time_slot, class_label, subject,
        room:rooms(id, name, display_name),
        mt:employees!schedule_assignments_mt_employee_id_fkey(id, short_name),
        ct:employees!schedule_assignments_ct_employee_id_fkey(id, short_name)
      `)
      .eq('month', monthIso)
      .order('id'),
    supabase.from('employees').select('id, short_name, category').eq('is_active', true).order('short_name'),
  ]);

  const byRoom: Map<number | null, Map<string, Cell[]>> = new Map();
  const byTeacher: ByTeacher = new Map();

  for (const a of (assignments ?? []) as unknown as Array<{
    id: number; day_of_week: string; time_slot: string; class_label: string | null; subject: string | null;
    room: { id: number; name: string; display_name: string | null } | null;
    mt: TeacherRef | null; ct: TeacherRef | null;
  }>) {
    const k = a.room?.id ?? null;
    const slotKey = `${a.day_of_week}|${a.time_slot}`;
    if (!byRoom.has(k)) byRoom.set(k, new Map());
    const bucket = byRoom.get(k)!;
    if (!bucket.has(slotKey)) bucket.set(slotKey, []);
    bucket.get(slotKey)!.push({
      id: a.id,
      class_label: a.class_label,
      subject: a.subject,
      mt: a.mt,
      ct: a.ct,
    });

    if (a.mt) {
      if (!byTeacher.has(a.mt.id)) byTeacher.set(a.mt.id, []);
      byTeacher.get(a.mt.id)!.push({ day: a.day_of_week, slot: a.time_slot, class: a.class_label, role: 'MT' });
    }
    if (a.ct) {
      if (!byTeacher.has(a.ct.id)) byTeacher.set(a.ct.id, []);
      byTeacher.get(a.ct.id)!.push({ day: a.day_of_week, slot: a.time_slot, class: a.class_label, role: 'CT' });
    }
  }

  const employeeList = (employees ?? []) as unknown as Employee[];
  const roomList = (rooms ?? []) as unknown as { id: number; name: string; display_name: string | null }[];

  return (
    <div className="page">
      <PageHeader
        title="Schedule"
        subtitle={`${monthLabel} · ${assignments?.length ?? 0} cells`}
        actions={
          <div className="flex gap-2">
            {(assignments?.length ?? 0) === 0 ? (
              <form action={copyFromPreviousMonth.bind(null, monthIso, false)}>
                <button type="submit" className="btn-ghost">Copy from previous month</button>
              </form>
            ) : (
              <form action={copyFromPreviousMonth.bind(null, monthIso, true)}>
                <button type="submit" className="btn-ghost"
                        title="Replaces all current cells with a copy of the previous month">
                  Re-copy from previous (overwrite)
                </button>
              </form>
            )}
            <Link href="/schedule/import" className="btn-ghost">Import CSV</Link>
            <Link href={`/schedule/new?month=${monthStr}`} className="btn-primary">+ Add cell</Link>
          </div>
        }
      />

      {copiedCount !== null && (
        <div className={`card mb-3 text-sm ${copiedCount > 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
          {copiedCount > 0
            ? `✓ Copied ${copiedCount} cells from ${copiedFrom ? new Date(copiedFrom).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'previous month'}. Edit any cell with the inline links.`
            : copiedFrom
              ? `Already has cells. Use "Re-copy from previous (overwrite)" if you want to replace.`
              : `No previous month with data found.`}
        </div>
      )}

      <form className="flex gap-2 mb-4 flex-wrap items-center">
        <input name="month" type="month" defaultValue={monthStr} className="input max-w-[180px]" />
        <input type="hidden" name="view" value={view} />
        <button className="btn-ghost">Apply</button>
        <div className="ml-auto inline-flex bg-slate-200/60 rounded-md p-0.5 flex-wrap">
          <Link href={`/schedule?month=${monthStr}&view=room`}
            className={`text-xs px-3 py-1.5 rounded ${view === 'room' ? 'bg-white shadow-sm font-medium' : 'text-slate-600'}`}>
            Room
          </Link>
          <Link href={`/schedule?month=${monthStr}&view=teacher`}
            className={`text-xs px-3 py-1.5 rounded ${view === 'teacher' ? 'bg-white shadow-sm font-medium' : 'text-slate-600'}`}>
            Teacher
          </Link>
          <Link href={`/schedule?month=${monthStr}&view=free`}
            className={`text-xs px-3 py-1.5 rounded ${view === 'free' ? 'bg-white shadow-sm font-medium' : 'text-slate-600'}`}>
            Free teachers
          </Link>
        </div>
      </form>

      {view === 'room' ? (
        <RoomGrid rooms={roomList} byRoom={byRoom} monthStr={monthStr} />
      ) : view === 'free' ? (
        <FreeBusyTable employees={employeeList} byTeacher={byTeacher} monthStr={monthStr} />
      ) : (
        <TeacherView
          employees={employeeList}
          byTeacher={byTeacher}
          monthStr={monthStr}
          monthLabel={monthLabel}
          selectedId={teacherId}
        />
      )}
    </div>
  );
}
