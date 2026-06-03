'use server';

import { requireRole, verifyCurrentPassword } from '@/lib/auth-guard';
import { audit } from '@/lib/audit';
import * as backup from '@/lib/backup';
import type { BackupRow, Frequency } from '@/lib/backup';

const OWNER = ['owner'] as const;

export async function listBackupsAction(): Promise<BackupRow[]> {
  await requireRole(OWNER);
  return backup.listBackups();
}

export async function createBackupAction(note?: string): Promise<number> {
  await requireRole(OWNER);
  const id = await backup.createBackup('manual', note?.trim() || 'manual via UI');
  await audit({ table: 'backups', action: 'backup_create', rowId: id });
  return id;
}

export async function deleteBackupAction(id: number): Promise<void> {
  await requireRole(OWNER);
  await backup.deleteBackup(id);
  await audit({ table: 'backups', action: 'backup_delete', rowId: id });
}

// Restore now requires the owner to re-enter their own password (server-verified
// with bcrypt) — replaces the old hardcoded client-side admin123 check.
export async function restoreFromBackupAction(id: number, password: string): Promise<number> {
  await requireRole(OWNER);
  if (!(await verifyCurrentPassword(password))) throw new Error('Password incorrect.');
  const restored = await backup.restoreFromBackup(id);
  await audit({ table: 'backups', action: 'backup_restore', rowId: id, diff: { restored } });
  return restored;
}

export async function getFrequencyAction(): Promise<Frequency> {
  await requireRole(OWNER);
  return backup.getFrequency();
}

export async function setFrequencyAction(freq: Frequency): Promise<Frequency> {
  await requireRole(OWNER);
  if (!['daily', 'weekly', 'hourly'].includes(freq)) throw new Error(`Invalid frequency: ${freq}`);
  await backup.setFrequency(freq);
  await audit({ table: 'app_settings', action: 'backup_schedule_set', rowId: 'backup_frequency', diff: { freq } });
  return freq;
}
