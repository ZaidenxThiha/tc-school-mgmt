'use server';

import { requireRole } from '@/lib/auth-guard';
import * as backup from '@/lib/backup';
import type { BackupRow, Frequency } from '@/lib/backup';

const OWNER = ['owner'] as const;

export async function listBackupsAction(): Promise<BackupRow[]> {
  await requireRole(OWNER);
  return backup.listBackups();
}

export async function createBackupAction(note?: string): Promise<number> {
  await requireRole(OWNER);
  return backup.createBackup('manual', note?.trim() || 'manual via UI');
}

export async function deleteBackupAction(id: number): Promise<void> {
  await requireRole(OWNER);
  await backup.deleteBackup(id);
}

export async function restoreFromBackupAction(id: number): Promise<number> {
  await requireRole(OWNER);
  return backup.restoreFromBackup(id);
}

export async function getFrequencyAction(): Promise<Frequency> {
  await requireRole(OWNER);
  return backup.getFrequency();
}

export async function setFrequencyAction(freq: Frequency): Promise<Frequency> {
  await requireRole(OWNER);
  if (!['daily', 'weekly', 'hourly'].includes(freq)) throw new Error(`Invalid frequency: ${freq}`);
  await backup.setFrequency(freq);
  return freq;
}
