import { sql } from '@/lib/db';
import { auth } from '@/auth';

// Append a security-audit entry. Best-effort: auditing must never break the
// action it records, so failures are swallowed (logged to the server console).
// `changedBy` defaults to the current session user; pass it explicitly from
// contexts without a session (e.g. the login flow).
export async function audit(entry: {
  table: string;
  action: string;
  rowId?: string | number | null;
  diff?: unknown;
  changedBy?: string | null;
}): Promise<void> {
  try {
    let changedBy = entry.changedBy ?? null;
    if (changedBy === undefined || changedBy === null) {
      const session = await auth();
      changedBy = (session?.user as { id?: string } | undefined)?.id ?? null;
    }
    await sql`
      insert into audit_log (table_name, row_id, action, changed_by, diff)
      values (${entry.table}, ${entry.rowId != null ? String(entry.rowId) : null}, ${entry.action},
              ${changedBy}, ${entry.diff != null ? sql.json(entry.diff as Parameters<typeof sql.json>[0]) : null})`;
  } catch (e) {
    console.error('[audit] failed to record', entry.action, e);
  }
}
