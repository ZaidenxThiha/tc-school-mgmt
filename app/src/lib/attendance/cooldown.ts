import { sql } from '@/lib/db';
import type { PersonType } from '@/lib/face/profiles';

// Server-side per-person cooldown — the authoritative defence against the same
// person being recorded repeatedly across consecutive camera frames (the
// frontend keeps its own cache too, but that is only an optimization). A
// successful recognition writes a 'recognized' scan-log row; if another scan for
// the same person lands within the cooldown window, we skip re-processing.
export async function isInCooldown(
  personId: number,
  personType: PersonType,
  cooldownSeconds: number,
): Promise<boolean> {
  const rows = (await sql`
    select 1 from attendance_scan_logs
    where person_id = ${personId}
      and person_type = ${personType}
      and match_status = 'recognized'
      and scanned_at > now() - (${cooldownSeconds} * interval '1 second')
    limit 1`) as unknown as { '?column?': number }[];
  return rows.length > 0;
}
