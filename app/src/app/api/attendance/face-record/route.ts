import { auth } from '@/auth';
import { recordPerson } from '@/lib/attendance/record';
import { getFaceConfig } from '@/lib/settings';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { ATTENDANCE_OPERATE } from '@/lib/auth-guard';
import type { PersonType } from '@/lib/face/profiles';

// Commit attendance for people already recognized by /recognize. Takes identities
// (not an image) so we don't re-embed. All duplicate/cooldown rules are enforced
// server-side regardless of what the client sends.
export const maxDuration = 30;

const OPERATE: readonly string[] = ATTENDANCE_OPERATE;

type IncomingPerson = { personId: number; personType: PersonType; similarity: number };

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || !OPERATE.includes(user.role ?? '')) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const rl = rateLimit(`face-record:${clientIp(req)}`, 60, 10_000);
  if (!rl.ok) return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });

  try {
    const body = (await req.json()) as { people?: IncomingPerson[]; deviceId?: string; location?: string };
    const people = Array.isArray(body.people) ? body.people : [];
    const valid = people.filter(
      (p) =>
        Number.isInteger(p.personId) &&
        p.personId > 0 &&
        (p.personType === 'student' || p.personType === 'employee') &&
        typeof p.similarity === 'number',
    );
    if (valid.length === 0) return Response.json({ results: [] });

    const cfg = await getFaceConfig();
    const ctx = { markedBy: user.id ?? null, deviceId: body.deviceId ?? null, location: body.location ?? null };

    const results = [];
    for (const p of valid) {
      // Re-floor against the live threshold; never trust a client similarity blindly.
      if (p.similarity < cfg.matchThreshold) continue;
      results.push(await recordPerson(p, ctx, cfg));
    }
    return Response.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
