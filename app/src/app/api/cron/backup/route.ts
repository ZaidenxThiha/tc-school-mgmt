import { createBackup, getFrequency } from '@/lib/backup';

// Auto-backup endpoint hit by Vercel Cron (see vercel.json). The cron fires
// daily at 02:00 UTC (the Hobby plan's max frequency; bump vercel.json to
// "0 * * * *" on Pro for true hourly). This route then decides whether to
// snapshot based on the owner-configured frequency in app_settings:
//   hourly → every run · daily → 02:00 UTC · weekly → Sunday 02:00 UTC
// (02:00 UTC ≈ 08:30 Asia/Yangon.) On Hobby, "hourly" effectively runs daily.
//
// Protected by CRON_SECRET: Vercel sends `Authorization: Bearer <CRON_SECRET>`
// when the env var is set. Requests without it are rejected.
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const freq = await getFrequency();
  const now = new Date();
  const hour = now.getUTCHours();
  const dow = now.getUTCDay(); // 0 = Sunday

  const shouldRun =
    freq === 'hourly' ? true :
    freq === 'weekly' ? dow === 0 && hour === 2 :
    /* daily */         hour === 2;

  if (!shouldRun) return Response.json({ skipped: true, frequency: freq, hour, dow });

  const id = await createBackup('auto', `cron: ${freq}`);
  return Response.json({ created: id, frequency: freq });
}
