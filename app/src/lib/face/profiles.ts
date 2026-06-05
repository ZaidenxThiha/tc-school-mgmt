import { sql } from '@/lib/db';
import { embedSingleFace } from '@/lib/face/engine';
import { checkQuality } from '@/lib/face/quality';
import { getFaceConfig } from '@/lib/settings';
import type { DetectedFace } from '@/lib/face/types';

export type PersonType = 'student' | 'employee';

// pgvector accepts a text literal like "[0.1,0.2,...]" cast to ::vector. postgres.js
// binds the string as a parameter, so this is injection-safe.
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export class FaceQualityError extends Error {
  constructor(reason: string) {
    super(`Face quality check failed: ${reason}`);
    this.name = 'FaceQualityError';
  }
}

// Insert a new active embedding for a person, deactivating any prior active one
// (re-record), so there is always exactly one active embedding per person.
// Stores ONLY the embedding — never an image.
async function insertFace(opts: {
  personId: number;
  personType: PersonType;
  embedding: number[];
  threshold: number;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: number }> {
  if (!Array.isArray(opts.embedding) || opts.embedding.length !== 512) {
    throw new Error('Invalid embedding (expected 512 floats).');
  }
  const vec = toVectorLiteral(opts.embedding);
  const meta = opts.metadata ?? {};
  const rows = (await sql`
    with deactivated as (
      update face_profiles set is_active = false, updated_at = now()
      where person_type = ${opts.personType} and person_id = ${opts.personId} and is_active
      returning 1
    )
    insert into face_profiles (person_id, person_type, embedding, model_name, threshold_used, metadata, created_by)
    values (${opts.personId}, ${opts.personType}, ${vec}::vector, 'buffalo_l',
            ${opts.threshold}, ${sql.json(meta as Parameters<typeof sql.json>[0])}, ${opts.createdBy ?? null})
    returning id`) as unknown as { id: number }[];
  return { id: rows[0].id };
}

// Server-side registration: app server embeds the image via a reachable sidecar.
// Used only when the app is configured to call a sidecar from the server.
export async function registerFace(opts: {
  personId: number;
  personType: PersonType;
  imageBase64: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: number }> {
  const cfg = await getFaceConfig();
  const face = await embedSingleFace(opts.imageBase64); // throws No/MultiFaceError
  const q = checkQuality(face, cfg.minFacePx);
  if (!q.ok) throw new FaceQualityError(q.reason);
  return insertFace({ ...opts, embedding: face.embedding, threshold: cfg.matchThreshold });
}

// Browser-direct registration: the browser already embedded the image on the
// local engine and sends the detected face (embedding + quality). We still apply
// the server-side quality gate against the live thresholds.
export async function registerFaceFromFace(opts: {
  personId: number;
  personType: PersonType;
  face: DetectedFace;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: number }> {
  const cfg = await getFaceConfig();
  const q = checkQuality(opts.face, cfg.minFacePx);
  if (!q.ok) throw new FaceQualityError(q.reason);
  return insertFace({ ...opts, embedding: opts.face.embedding, threshold: cfg.matchThreshold });
}

// Deactivate (soft-delete) a person's face profile by row id.
export async function deactivateFaceById(id: number): Promise<boolean> {
  const rows = (await sql`
    update face_profiles set is_active = false, updated_at = now()
    where id = ${id} and is_active returning id`) as unknown as { id: number }[];
  return rows.length > 0;
}

export type FaceMatch = {
  personId: number;
  personType: PersonType;
  similarity: number; // cosine similarity 0..1
};

// Nearest active face to a query embedding (exact cosine search in pgvector).
// Returns null only when there are no registered faces at all.
export async function matchEmbedding(embedding: number[]): Promise<FaceMatch | null> {
  const vec = toVectorLiteral(embedding);
  const rows = (await sql`
    select person_id, person_type, 1 - (embedding <=> ${vec}::vector) as similarity
    from face_profiles
    where is_active
    order by embedding <=> ${vec}::vector
    limit 1`) as unknown as { person_id: number; person_type: PersonType; similarity: number }[];
  const r = rows[0];
  if (!r) return null;
  return { personId: r.person_id, personType: r.person_type, similarity: Number(r.similarity) };
}

// Display helpers: resolve a recognized person to a human name.
export async function resolveName(personId: number, personType: PersonType): Promise<string> {
  if (personType === 'student') {
    const rows = (await sql`
      select english_name, myanmar_name from students where id = ${personId} limit 1`) as unknown as {
      english_name: string | null;
      myanmar_name: string | null;
    }[];
    const s = rows[0];
    return s?.english_name ?? s?.myanmar_name ?? `Student #${personId}`;
  }
  const rows = (await sql`select full_name, short_name from employees where id = ${personId} limit 1`) as unknown as {
    full_name: string | null;
    short_name: string | null;
  }[];
  const e = rows[0];
  return e?.full_name ?? e?.short_name ?? `Employee #${personId}`;
}

// Who already has / lacks a face — used to drive the Record Face page lists.
export async function listFaceProfiles(): Promise<
  { id: number; person_id: number; person_type: PersonType; name: string; updated_at: string }[]
> {
  return (await sql`
    select fp.id, fp.person_id, fp.person_type,
           coalesce(s.english_name, s.myanmar_name, e.full_name, e.short_name,
                    fp.person_type || ' #' || fp.person_id) as name,
           to_char(fp.updated_at, 'YYYY-MM-DD HH24:MI') as updated_at
    from face_profiles fp
    left join students s on fp.person_type = 'student' and s.id = fp.person_id
    left join employees e on fp.person_type = 'employee' and e.id = fp.person_id
    where fp.is_active
    order by fp.updated_at desc`) as unknown as {
    id: number;
    person_id: number;
    person_type: PersonType;
    name: string;
    updated_at: string;
  }[];
}
