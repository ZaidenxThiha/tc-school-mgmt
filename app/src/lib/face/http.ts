import { NoFaceError, MultiFaceError, FaceEngineError } from '@/lib/face/engine';
import { FaceQualityError } from '@/lib/face/profiles';

// Map face-pipeline errors to HTTP responses. Lives in lib (not a route file) so
// it can be shared — Next.js route modules may only export request handlers.
export function mapFaceError(e: unknown): Response {
  if (e instanceof NoFaceError || e instanceof MultiFaceError || e instanceof FaceQualityError) {
    return Response.json({ error: e.message }, { status: 422 });
  }
  if (e instanceof FaceEngineError) {
    return Response.json({ error: e.message }, { status: 502 });
  }
  const message = e instanceof Error ? e.message : String(e);
  return Response.json({ error: message }, { status: 500 });
}
