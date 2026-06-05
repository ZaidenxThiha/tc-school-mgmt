import { auth } from '@/auth';
import { embedImage } from '@/lib/face/engine';
import { matchEmbedding, resolveName } from '@/lib/face/profiles';
import { checkQuality } from '@/lib/face/quality';
import { getFaceConfig } from '@/lib/settings';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { mapFaceError } from '@/lib/face/http';
import { ATTENDANCE_OPERATE } from '@/lib/auth-guard';

// Recognize every face in one camera frame. READ-ONLY: it does not write
// attendance — the client posts the accepted people to /api/attendance/face-record.
// This keeps embedding cost to one pass per frame.
export const maxDuration = 30;

const OPERATE: readonly string[] = ATTENDANCE_OPERATE;

type RecognizedFace = {
  bbox: [number, number, number, number];
  det_score: number;
  status: 'recognized' | 'unknown' | 'low_confidence';
  match: { personId: number; personType: string; name: string; similarity: number } | null;
  reason?: string;
};

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (!OPERATE.includes(role)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const rl = rateLimit(`recognize:${clientIp(req)}`, 40, 10_000);
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });

  try {
    const body = (await req.json()) as { image?: string };
    if (!body.image) return Response.json({ error: 'image is required.' }, { status: 400 });

    const cfg = await getFaceConfig();
    const faces = await embedImage(body.image);

    const results: RecognizedFace[] = [];
    for (const f of faces) {
      const q = checkQuality(f, cfg.minFacePx);
      const match = await matchEmbedding(f.embedding);
      if (!match || match.similarity < cfg.matchThreshold) {
        results.push({
          bbox: f.bbox,
          det_score: f.det_score,
          status: !q.ok ? 'low_confidence' : 'unknown',
          match: null,
          reason: !q.ok ? q.reason : 'below_threshold',
        });
        continue;
      }
      const name = await resolveName(match.personId, match.personType);
      results.push({
        bbox: f.bbox,
        det_score: f.det_score,
        status: 'recognized',
        match: { personId: match.personId, personType: match.personType, name, similarity: Number(match.similarity.toFixed(4)) },
      });
    }
    return Response.json({ faces: results, threshold: cfg.matchThreshold });
  } catch (e) {
    return mapFaceError(e);
  }
}
