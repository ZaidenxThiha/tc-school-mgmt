import { auth } from '@/auth';
import { restoreFromPayload, type BackupPayload } from '@/lib/backup';

// Owner-only restore from an uploaded backup file (multipart form, field "file").
// Uses a route handler rather than a server action to avoid the 1 MB server-action
// body limit — full backups are several MB.
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== 'owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'No file uploaded.' }, { status: 400 });
    const payload = JSON.parse(await file.text()) as BackupPayload;
    if (!payload?.tables) return Response.json({ error: 'Not a valid backup file (missing "tables").' }, { status: 400 });
    const restored = await restoreFromPayload(payload);
    return Response.json({ restored });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
