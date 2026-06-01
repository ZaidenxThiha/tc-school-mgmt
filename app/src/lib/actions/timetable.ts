'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ParsedClass } from '@/lib/parse-timetable';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const normLevel = (s: string) => norm(s).replace(/s$/, ''); // tolerate plural ("Starters" → "starter")

export type ImportResult = {
  created: number;
  unmatchedTeachers: string[];
  unmatchedLevels: string[];
  unmatchedRooms: string[];
};

// Maps parsed timetable rows to IDs and replaces the target month's schedule.
export async function importTimetable(monthStr: string, classes: ParsedClass[]): Promise<ImportResult> {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new Error('Invalid month (expected YYYY-MM)');
  if (!Array.isArray(classes) || classes.length === 0) throw new Error('Nothing to import');
  const month = `${monthStr}-01`;
  const supabase = await createClient();

  const [{ data: emps }, { data: rooms }, { data: sections }] = await Promise.all([
    supabase.from('employees').select('id, short_name'),
    supabase.from('rooms').select('id, name'),
    supabase.from('sections').select('id, time_slot, is_online, level:levels(name)'),
  ]);

  const empMap = new Map<string, number>();
  for (const e of emps ?? []) if (e.short_name) empMap.set(norm(e.short_name), e.id);
  const roomMap = new Map<string, number>();
  for (const r of rooms ?? []) roomMap.set(norm(r.name), r.id);
  const secExact = new Map<string, number>();
  const secAny = new Map<string, number>();
  for (const s of sections ?? []) {
    const ln = normLevel((s.level as unknown as { name: string } | null)?.name ?? '');
    if (!secAny.has(`${ln}|${s.time_slot}`)) secAny.set(`${ln}|${s.time_slot}`, s.id);
    secExact.set(`${ln}|${s.time_slot}|${s.is_online}`, s.id);
  }

  const teachers = new Set<string>(), levels = new Set<string>(), rms = new Set<string>();
  const inserts = classes.map((c) => {
    const ln = normLevel(c.level);
    const section_id = secExact.get(`${ln}|${c.time_slot}|${c.online}`) ?? secAny.get(`${ln}|${c.time_slot}`) ?? null;
    if (!section_id) levels.add(c.level);
    const room_id = c.room ? roomMap.get(norm(c.room)) ?? null : null;
    if (c.room && !room_id) rms.add(c.room);
    const mt_employee_id = c.mt ? empMap.get(norm(c.mt)) ?? null : null;
    if (c.mt && !mt_employee_id) teachers.add(c.mt);
    const ct_employee_id = c.ct ? empMap.get(norm(c.ct)) ?? null : null;
    if (c.ct && !ct_employee_id) teachers.add(c.ct);
    return {
      month, day_of_week: c.day, time_slot: c.time_slot, room_id, section_id,
      class_label: c.class_label, subject: c.subject || null, mt_employee_id, ct_employee_id,
    };
  });

  // Replace the month's schedule so re-importing is idempotent.
  const { error: delErr } = await supabase.from('schedule_assignments').delete().eq('month', month);
  if (delErr) throw new Error(delErr.message);
  const { error } = await supabase.from('schedule_assignments').insert(inserts);
  if (error) throw new Error(error.message);

  revalidatePath('/schedule');
  return {
    created: inserts.length,
    unmatchedTeachers: [...teachers],
    unmatchedLevels: [...levels],
    unmatchedRooms: [...rms],
  };
}
