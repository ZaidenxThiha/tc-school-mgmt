import { sql } from '@/lib/db';

// Low-level backup/restore helpers backed by the Neon functions in
// migration-neon/06_backup.sql. Authorization is enforced by the callers
// (server actions via requireRole, the cron route via CRON_SECRET) — these do
// not check roles themselves.

export type BackupPayload = {
  version: number;
  created_at: string;
  row_count: number;
  tables: Record<string, unknown[]>;
};

export type BackupRow = {
  id: number;
  source: 'auto' | 'manual';
  row_count: number;
  size_bytes: number;
  notes: string | null;
  created_at: string;
};

export type Frequency = 'daily' | 'weekly' | 'hourly';

// Fresh full-database snapshot (not persisted).
export async function fullBackup(): Promise<BackupPayload> {
  const rows = (await sql`select backup_all_data_internal() as j`) as unknown as { j: BackupPayload }[];
  return rows[0].j;
}

// Snapshot + persist to the backups table, then prune (keep 30 auto / 50 manual).
export async function createBackup(source: 'auto' | 'manual' = 'manual', note: string | null = null): Promise<number> {
  const payload = await fullBackup();
  const rows = (await sql`
    insert into backups (source, row_count, size_bytes, payload, notes)
    values (${source}, ${payload.row_count}, ${JSON.stringify(payload).length}, ${sql.json(payload as unknown as Parameters<typeof sql.json>[0])}, ${note})
    returning id`) as unknown as { id: number }[];
  const id = Number(rows[0].id);
  await sql`delete from backups where id in (
    select id from backups where source = 'auto'   order by created_at desc offset 30)`;
  await sql`delete from backups where id in (
    select id from backups where source = 'manual' order by created_at desc offset 50)`;
  return id;
}

export async function listBackups(): Promise<BackupRow[]> {
  const rows = (await sql`
    select id, source, row_count, size_bytes, notes, created_at
    from backups order by created_at desc limit 200`) as unknown as BackupRow[];
  return rows.map((r) => ({ ...r, id: Number(r.id), row_count: Number(r.row_count), size_bytes: Number(r.size_bytes) }));
}

export async function getBackupPayload(id: number): Promise<BackupPayload | null> {
  const rows = (await sql`select payload from backups where id = ${id}`) as unknown as { payload: BackupPayload }[];
  return rows[0]?.payload ?? null;
}

export async function deleteBackup(id: number): Promise<void> {
  await sql`delete from backups where id = ${id}`;
}

// Truncate + reload from a payload object. Returns the number of rows restored.
export async function restoreFromPayload(payload: BackupPayload): Promise<number> {
  if (!payload || typeof payload !== 'object' || !('tables' in payload)) {
    throw new Error('Not a valid backup payload (missing "tables").');
  }
  const rows = (await sql.unsafe('select restore_all_data($1::jsonb) as n', [payload as unknown as never])) as unknown as { n: number }[];
  return Number(rows[0].n);
}

export async function restoreFromBackup(id: number): Promise<number> {
  const payload = await getBackupPayload(id);
  if (!payload) throw new Error(`Backup ${id} not found.`);
  return restoreFromPayload(payload);
}

export async function getFrequency(): Promise<Frequency> {
  const rows = (await sql`select value from app_settings where key = 'backup_frequency'`) as unknown as { value: string }[];
  const v = rows[0]?.value as Frequency | undefined;
  return v === 'weekly' || v === 'hourly' ? v : 'daily';
}

export async function setFrequency(freq: Frequency): Promise<void> {
  await sql`
    insert into app_settings (key, value, updated_at)
    values ('backup_frequency', ${freq}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
