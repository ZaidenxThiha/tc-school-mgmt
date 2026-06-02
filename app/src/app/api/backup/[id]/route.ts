import { auth } from '@/auth';
import { getBackupPayload } from '@/lib/backup';

// Owner-only download of a stored backup's payload as a JSON file.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== 'owner') {
    return new Response('Forbidden', { status: 403 });
  }
  const { id } = await params;
  const payload = await getBackupPayload(Number(id));
  if (!payload) return new Response('Not found', { status: 404 });
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="tnc-backup-${id}-${ts}.json"`,
    },
  });
}
