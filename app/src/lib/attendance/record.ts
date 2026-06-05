import { sql } from '@/lib/db';
import type { PersonType } from '@/lib/face/profiles';
import { resolveName } from '@/lib/face/profiles';
import { resolveActiveSession, yangonNow } from '@/lib/attendance/session-resolver';
import { isInCooldown } from '@/lib/attendance/cooldown';
import { getFaceConfig, type FaceConfig } from '@/lib/settings';

// Outcome statuses surfaced to the camera UI.
export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'checked_in'
  | 'checked_out'
  | 'already_recorded'
  | 'already_completed'
  | 'no_active_class'
  | 'cooldown'
  | 'failed';

export type RecordResult = {
  personId: number;
  personType: PersonType;
  name: string;
  similarity: number;
  status: AttendanceStatus;
  detail?: string;
};

type Ctx = {
  markedBy?: string | null; // operator user id (uuid)
  deviceId?: string | null;
  location?: string | null;
};

async function logScan(opts: {
  personId: number | null;
  personType: PersonType | null;
  matchStatus: string;
  confidence?: number | null;
  reason?: string | null;
  ctx?: Ctx;
}): Promise<void> {
  try {
    await sql`
      insert into attendance_scan_logs
        (person_id, person_type, match_status, confidence_score, reason, device_id, location)
      values (${opts.personId}, ${opts.personType}, ${opts.matchStatus},
              ${opts.confidence ?? null}, ${opts.reason ?? null},
              ${opts.ctx?.deviceId ?? null}, ${opts.ctx?.location ?? null})`;
  } catch (e) {
    console.error('[attendance] scan-log failed', e);
  }
}

// Record one recognized person. Applies cooldown, then student or employee logic,
// with all duplicate rules enforced at the DB level (unique constraints + upsert).
export async function recordPerson(
  match: { personId: number; personType: PersonType; similarity: number },
  ctx: Ctx = {},
  cfg?: FaceConfig,
): Promise<RecordResult> {
  const config = cfg ?? (await getFaceConfig());
  const name = await resolveName(match.personId, match.personType);
  const base = { personId: match.personId, personType: match.personType, name, similarity: match.similarity };

  if (await isInCooldown(match.personId, match.personType, config.cooldownSeconds)) {
    await logScan({ personId: match.personId, personType: match.personType, matchStatus: 'duplicate', confidence: match.similarity, reason: 'cooldown', ctx });
    return { ...base, status: 'cooldown', detail: 'Already recorded moments ago.' };
  }

  const result =
    match.personType === 'student'
      ? await recordStudent(match, ctx, config)
      : await recordEmployee(match, ctx);

  // A successful identification doubles as the cooldown marker.
  await logScan({ personId: match.personId, personType: match.personType, matchStatus: 'recognized', confidence: match.similarity, reason: result.status, ctx });
  return { ...base, ...result };
}

async function recordStudent(
  match: { personId: number; similarity: number },
  ctx: Ctx,
  cfg: FaceConfig,
): Promise<{ status: AttendanceStatus; detail?: string }> {
  const resolved = await resolveActiveSession(match.personId);
  if (resolved.kind === 'none') {
    await logScan({ personId: match.personId, personType: 'student', matchStatus: 'no_active_class', confidence: match.similarity, reason: resolved.reason, ctx });
    return { status: 'no_active_class', detail: 'No active class found.' };
  }

  const late = resolved.nowMinutes > resolved.slotStartMinutes + cfg.lateMinutes;
  const status = late ? 'Late' : 'Present';

  const inserted = (await sql`
    insert into attendance_marks
      (session_id, student_id, status, marked_at, marked_by, scan_time, confidence_score, source, subject)
    values (${resolved.sessionId}, ${match.personId}, ${status}, now(), ${ctx.markedBy ?? null},
            now(), ${match.similarity}, 'face_camera', ${resolved.subject})
    on conflict (session_id, student_id) do nothing
    returning student_id`) as unknown as { student_id: number }[];

  if (inserted.length === 0) return { status: 'already_recorded', detail: 'Already recorded for this class.' };
  return { status: late ? 'late' : 'present' };
}

async function recordEmployee(
  match: { personId: number; similarity: number },
  ctx: Ctx,
): Promise<{ status: AttendanceStatus; detail?: string }> {
  const dateIso = yangonNow().dateIso;

  // Attempt check-in; the unique (employee_id, attendance_date) makes this atomic.
  const checkedIn = (await sql`
    insert into employee_attendance
      (employee_id, attendance_date, check_in_time, check_in_confidence, status, device_id, location)
    values (${match.personId}, ${dateIso}, now(), ${match.similarity}, 'incomplete',
            ${ctx.deviceId ?? null}, ${ctx.location ?? null})
    on conflict (employee_id, attendance_date) do nothing
    returning id`) as unknown as { id: number }[];
  if (checkedIn.length > 0) return { status: 'checked_in', detail: 'Checked in.' };

  // Row exists today → decide check-out vs already-complete.
  const rows = (await sql`
    select check_in_time, check_out_time from employee_attendance
    where employee_id = ${match.personId} and attendance_date = ${dateIso} limit 1`) as unknown as {
    check_in_time: string | null;
    check_out_time: string | null;
  }[];
  const row = rows[0];
  if (row && row.check_out_time) return { status: 'already_completed', detail: 'Already completed.' };

  await sql`
    update employee_attendance
    set check_out_time = now(), check_out_confidence = ${match.similarity}, status = 'completed', updated_at = now()
    where employee_id = ${match.personId} and attendance_date = ${dateIso} and check_out_time is null`;
  return { status: 'checked_out', detail: 'Checked out.' };
}

// Log a non-matching detection (unknown / low confidence) for admin review.
export async function logUnknown(
  matchStatus: 'unknown' | 'low_confidence',
  similarity: number | null,
  ctx: Ctx = {},
): Promise<void> {
  await logScan({ personId: null, personType: null, matchStatus, confidence: similarity, reason: matchStatus, ctx });
}
