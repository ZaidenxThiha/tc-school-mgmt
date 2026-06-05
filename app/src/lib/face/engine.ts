// Server-side client for the Python face-engine sidecar (used when the app is
// configured to reach a sidecar from the server, e.g. a hosted deployment). In
// the browser-direct mode (default for the camera UI) the browser calls the
// local engine itself — see lib/face/browser.ts.

export type { FaceQuality, DetectedFace } from '@/lib/face/types';
import type { DetectedFace } from '@/lib/face/types';

// Typed errors so the registration flow can show the exact required messages.
export class NoFaceError extends Error {
  constructor() {
    super('No face detected.');
    this.name = 'NoFaceError';
  }
}
export class MultiFaceError extends Error {
  constructor() {
    super('Multiple faces detected. Please use a single-face photo.');
    this.name = 'MultiFaceError';
  }
}
export class FaceEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FaceEngineError';
  }
}

function engineConfig(): { url: string; token: string } {
  const url = process.env.FACE_ENGINE_URL;
  const token = process.env.FACE_ENGINE_TOKEN;
  if (!url || !token) throw new FaceEngineError('Face engine is not configured (FACE_ENGINE_URL / FACE_ENGINE_TOKEN).');
  return { url: url.replace(/\/$/, ''), token };
}

// Detect + embed every face in an image (base64 jpeg/png; data: URL tolerated).
export async function embedImage(imageBase64: string): Promise<DetectedFace[]> {
  const { url, token } = engineConfig();
  // In local dev, transparently launch the sidecar if it isn't running yet so
  // "Save face" / scanning works without manually starting uvicorn. No-op in prod.
  const { ensureFaceEngine } = await import('@/lib/face/autostart');
  await ensureFaceEngine();
  let res: Response;
  try {
    res = await fetch(`${url}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: imageBase64 }),
      // The sidecar is the slow part; keep the route's maxDuration generous.
      cache: 'no-store',
    });
  } catch (e) {
    throw new FaceEngineError(`Face engine unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new FaceEngineError(`Face engine error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { faces?: DetectedFace[] };
  return data.faces ?? [];
}

// Registration helper: require exactly one good face, else the spec'd messages.
export async function embedSingleFace(imageBase64: string): Promise<DetectedFace> {
  const faces = await embedImage(imageBase64);
  if (faces.length === 0) throw new NoFaceError();
  if (faces.length > 1) throw new MultiFaceError();
  return faces[0];
}
