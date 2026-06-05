import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { registerFace, deactivateFaceById, type PersonType } from '@/lib/face/profiles';
import { audit } from '@/lib/audit';
import { mapFaceError } from '@/lib/face/http';

// Re-record (PUT) or deactivate (DELETE) an existing face profile. Admin-only.
export const maxDuration = 60;

const ADMIN = ['owner', 'admin'];

async function requireAdmin(): Promise<{ id?: string; role?: string } | null> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || !ADMIN.includes(user.role ?? '')) return null;
  return user;
}

// PUT — replace the embedding for the person this profile belongs to (a new
// active row is inserted and the old one deactivated).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  try {
    const rows = (await sql`select person_id, person_type from face_profiles where id = ${Number(id)} limit 1`) as unknown as {
      person_id: number;
      person_type: PersonType;
    }[];
    const existing = rows[0];
    if (!existing) return Response.json({ error: 'Face profile not found.' }, { status: 404 });

    const body = (await req.json()) as { image?: string };
    if (!body.image) return Response.json({ error: 'image is required.' }, { status: 400 });

    const res = await registerFace({
      personId: existing.person_id,
      personType: existing.person_type,
      imageBase64: body.image,
      createdBy: user.id ?? null,
    });
    await audit({ table: 'face_profiles', action: 'face_update', rowId: res.id, diff: { personId: existing.person_id, personType: existing.person_type } });
    return Response.json({ id: res.id });
  } catch (e) {
    return mapFaceError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const ok = await deactivateFaceById(Number(id));
  if (!ok) return Response.json({ error: 'Face profile not found or already inactive.' }, { status: 404 });
  await audit({ table: 'face_profiles', action: 'face_delete', rowId: Number(id) });
  return Response.json({ ok: true });
}
