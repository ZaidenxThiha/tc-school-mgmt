import { auth } from '@/auth';
import { registerFace, registerFaceFromFace, type PersonType } from '@/lib/face/profiles';
import { mapFaceError } from '@/lib/face/http';
import { audit } from '@/lib/audit';
import type { DetectedFace } from '@/lib/face/types';

// Register a face embedding for a student or employee. Admin-only. Two modes:
//  - browser-direct (default): the browser embeds the image on the local engine
//    and POSTs the detected `face` (embedding + quality) — no image stored or sent.
//  - server-side: POST an `image` for the app to embed via a reachable sidecar.
export const maxDuration = 60;

const ADMIN = ['owner', 'admin'];

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || !ADMIN.includes(user.role ?? '')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = (await req.json()) as { personId?: number; personType?: string; image?: string; face?: DetectedFace };
    const personId = Number(body.personId);
    const personType = body.personType as PersonType;
    if (!Number.isInteger(personId) || personId <= 0 || (personType !== 'student' && personType !== 'employee')) {
      return Response.json({ error: 'personId and personType (student|employee) are required.' }, { status: 400 });
    }

    let id: number;
    if (body.face && Array.isArray(body.face.embedding)) {
      ({ id } = await registerFaceFromFace({ personId, personType, face: body.face, createdBy: user.id ?? null }));
    } else if (typeof body.image === 'string' && body.image) {
      ({ id } = await registerFace({ personId, personType, imageBase64: body.image, createdBy: user.id ?? null }));
    } else {
      return Response.json({ error: 'A detected face (or image) is required.' }, { status: 400 });
    }
    await audit({ table: 'face_profiles', action: 'face_create', rowId: id, diff: { personId, personType } });
    return Response.json({ id });
  } catch (e) {
    return mapFaceError(e);
  }
}
