import { auth } from '@/auth';
import { fullBackup } from '@/lib/backup';

// Owner-only fresh full-database backup as a downloadable JSON file.
export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== 'owner') {
    return new Response('Forbidden', { status: 403 });
  }
  const payload = await fullBackup();
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="tnc-backup-${ts}.json"`,
    },
  });
}
