import { sql } from '@/lib/db';

// Resolves "which class is this student in right now?" with no manual selection.
//
// Domain facts (see src/lib/parse-timetable.ts): classes run Sat & Sun only, in
// four fixed time slots, and the monthly plan lives in schedule_assignments
// (month, day_of_week 'Sat'|'Sun', time_slot text, section_id). A student's
// section comes from their active enrolment. All time math is in Asia/Yangon
// (the school's local time), since timestamps are stored as timestamptz.

const TZ = 'Asia/Yangon';

// The four known slots → [startMin, endMin] minutes-from-midnight (24h).
// 1-3 / 3:15-5:15 are afternoon, so they map to 13:00-15:00 / 15:15-17:15.
const SLOT_TIMES: Record<string, { start: number; end: number; startLabel: string }> = {
  '7:45-9:45': { start: 7 * 60 + 45, end: 9 * 60 + 45, startLabel: '07:45' },
  '10-12': { start: 10 * 60, end: 12 * 60, startLabel: '10:00' },
  '1-3': { start: 13 * 60, end: 15 * 60, startLabel: '13:00' },
  '3:15-5:15': { start: 15 * 60 + 15, end: 17 * 60 + 15, startLabel: '15:15' },
};

const GRACE_BEFORE = 30; // count a scan up to 30 min before the slot start
const GRACE_AFTER = 15; // …and up to 15 min after it ends

export type YangonNow = {
  dow: string; // 'Sat' | 'Sun' | other 3-letter day
  isClassDay: boolean;
  minutesOfDay: number;
  dateIso: string; // YYYY-MM-DD (local)
  monthIso: string; // YYYY-MM-01 (local)
};

// Break a Date into Asia/Yangon calendar parts (no external tz lib needed).
export function yangonNow(now: Date = new Date()): YangonNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dow = get('weekday');
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  if (hour === '24') hour = '00'; // some engines emit 24 for midnight
  const minute = get('minute');
  return {
    dow,
    isClassDay: dow === 'Sat' || dow === 'Sun',
    minutesOfDay: Number(hour) * 60 + Number(minute),
    dateIso: `${year}-${month}-${day}`,
    monthIso: `${year}-${month}-01`,
  };
}

// Which slot contains `minutesOfDay` (with grace)? Nearest start wins on overlap.
export function currentSlot(minutesOfDay: number): { slot: string; start: number; startLabel: string } | null {
  let best: { slot: string; start: number; startLabel: string } | null = null;
  for (const [slot, t] of Object.entries(SLOT_TIMES)) {
    if (minutesOfDay >= t.start - GRACE_BEFORE && minutesOfDay <= t.end + GRACE_AFTER) {
      if (!best || Math.abs(minutesOfDay - t.start) < Math.abs(minutesOfDay - best.start)) {
        best = { slot, start: t.start, startLabel: t.startLabel };
      }
    }
  }
  return best;
}

export type SessionResolution =
  | {
      kind: 'active';
      sectionId: number;
      sessionId: number;
      subject: string | null;
      slot: string;
      slotStartMinutes: number;
      nowMinutes: number;
    }
  | { kind: 'none'; reason: 'not_class_day' | 'no_active_slot' | 'not_enrolled' };

// Find (and get-or-create) the active session for a student at `now`.
export async function resolveActiveSession(studentId: number, now: Date = new Date()): Promise<SessionResolution> {
  const t = yangonNow(now);
  if (!t.isClassDay) return { kind: 'none', reason: 'not_class_day' };

  const slot = currentSlot(t.minutesOfDay);
  if (!slot) return { kind: 'none', reason: 'no_active_slot' };

  // The student's section for this month/day/slot, via their active enrolment.
  const rows = (await sql`
    select sa.section_id, sa.subject
    from schedule_assignments sa
    join enrolments en on en.section_id = sa.section_id
    where sa.month = ${t.monthIso}
      and sa.day_of_week = ${t.dow}
      and sa.time_slot = ${slot.slot}
      and en.student_id = ${studentId}
      and en.status = 'Active'
      and en.start_date <= ${t.dateIso}
      and (en.end_date is null or en.end_date >= ${t.dateIso})
    order by sa.section_id
    limit 1`) as unknown as { section_id: number; subject: string | null }[];

  const match = rows[0];
  if (!match) return { kind: 'none', reason: 'not_enrolled' };

  const sessionId = await getOrCreateSession(match.section_id, t.dateIso, slot.startLabel);
  return {
    kind: 'active',
    sectionId: match.section_id,
    sessionId,
    subject: match.subject,
    slot: slot.slot,
    slotStartMinutes: slot.start,
    nowMinutes: t.minutesOfDay,
  };
}

// One class_sessions row per (section, day). Unique constraint makes this safe
// under concurrent scans.
export async function getOrCreateSession(sectionId: number, dateIso: string, startLabel: string): Promise<number> {
  const rows = (await sql`
    insert into class_sessions (section_id, session_date, start_time)
    values (${sectionId}, ${dateIso}, ${startLabel})
    on conflict (section_id, session_date)
      do update set start_time = coalesce(class_sessions.start_time, excluded.start_time)
    returning id`) as unknown as { id: number }[];
  return rows[0].id;
}
