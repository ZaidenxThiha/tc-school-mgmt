'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import { deactivateFaceById } from '@/lib/face/profiles';
import { setSetting } from '@/lib/settings';
import { audit } from '@/lib/audit';

// Deactivate a registered face (soft delete). Registration/re-record go through
// the /api/face-profiles route because they carry an image payload.
export async function deactivateFaceAction(id: number): Promise<void> {
  await requireRole(WRITE_ADMIN);
  const ok = await deactivateFaceById(id);
  if (ok) await audit({ table: 'face_profiles', action: 'face_delete', rowId: id });
  revalidatePath('/attendance/record-face');
}

const ConfigSchema = z.object({
  match_threshold: z.coerce.number().min(0).max(1),
  late_minutes: z.coerce.number().int().min(0).max(120),
  cooldown_seconds: z.coerce.number().int().min(0).max(3600),
  min_face_px: z.coerce.number().int().min(20).max(1000),
});

// Update the face tunables (app_settings) from the Record Face config form.
export async function updateFaceConfigAction(formData: FormData): Promise<void> {
  await requireRole(WRITE_ADMIN);
  const cfg = ConfigSchema.parse({
    match_threshold: formData.get('match_threshold'),
    late_minutes: formData.get('late_minutes'),
    cooldown_seconds: formData.get('cooldown_seconds'),
    min_face_px: formData.get('min_face_px'),
  });
  await Promise.all([
    setSetting('face.match_threshold', String(cfg.match_threshold)),
    setSetting('face.late_minutes', String(cfg.late_minutes)),
    setSetting('face.cooldown_seconds', String(cfg.cooldown_seconds)),
    setSetting('face.min_face_px', String(cfg.min_face_px)),
  ]);
  await audit({ table: 'app_settings', action: 'face_config_update', diff: cfg });
  revalidatePath('/attendance/record-face');
}
