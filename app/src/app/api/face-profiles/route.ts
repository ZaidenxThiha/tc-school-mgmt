import { auth } from '@/auth';
import { registerFace, type PersonType } from '@/lib/face/profiles';
import { mapFaceError } from '@/lib/face/http';
import { audit } from '@/lib/audit';

// Register a new face embedding for a student or employee. Admin-only. The image
// is forwarded to the sidecar, turned into an embedding, and discarded — never
// stored. Uses a route handler (not a server action) for the image payload.
export const maxDuration = 60;

const ADMIN = ['owner', 'admin'];

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || !ADMIN.includes(user.role ?? '')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = (await req.json()) as { personId?: number; personType?: string; image?: string };
    const personId = Number(body.personId);
    const personType = body.personType as PersonType;
    if (!Number.isInteger(personId) || personId <= 0 || (personType !== 'student' && personType !== 'employee')) {
      return Response.json({ error: 'personId and personType (student|employee) are required.' }, { status: 400 });
    }
    if (!body.image || typeof body.image !== 'string') {
      return Response.json({ error: 'image is required.' }, { status: 400 });
    }
    const { id } = await registerFace({ personId, personType, imageBase64: body.image, createdBy: user.id ?? null });
    await audit({ table: 'face_profiles', action: 'face_create', rowId: id, diff: { personId, personType } });
    return Response.json({ id });
  } catch (e) {
    return mapFaceError(e);
  }
}
