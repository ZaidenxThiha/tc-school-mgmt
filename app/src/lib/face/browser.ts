// Browser-side client for the LOCAL face engine. Runs in the operator's browser
// and talks directly to the Python sidecar on this machine (127.0.0.1:8000), so
// the engine runs on whatever laptop has the site open — even when the site
// itself is served from Vercel. Images never leave the laptop; only the 512-d
// embedding is sent on to the app server.

import type { DetectedFace } from '@/lib/face/types';

// Override per-machine via localStorage 'faceEngineUrl' if the sidecar runs on a
// different port/host.
export function localEngineUrl(): string {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('faceEngineUrl');
    if (stored) return stored.replace(/\/$/, '');
  }
  return 'http://127.0.0.1:8000';
}

export class LocalEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalEngineError';
  }
}

const UNREACHABLE =
  'Can’t reach the face engine on this computer. Start it (run face-engine on this laptop) and try again.';

const LAUNCHER_URL = 'http://127.0.0.1:8765';

async function waitForEngine(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await localEngineReady()) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

// Ensure the local Python sidecar is running before scanning or registration.
// Tries: already up → Next.js autostart (same laptop) → local launcher (Vercel + laptop).
export async function ensureLocalEngine(): Promise<void> {
  if (await localEngineReady()) return;

  // When Next.js runs on this machine, the server can spawn uvicorn.
  try {
    await fetch('/api/face-engine/ensure', { method: 'POST', cache: 'no-store' });
  } catch {
    // Expected when the site is served from Vercel.
  }
  if (await waitForEngine(30_000)) return;

  // Deployed site: the launcher (run.command) must be open on this laptop.
  try {
    await fetch(`${LAUNCHER_URL}/start`, { method: 'POST', cache: 'no-store' });
  } catch {
    // Launcher not running.
  }
  if (await waitForEngine(120_000)) return;

  throw new LocalEngineError(UNREACHABLE);
}

// Detect + embed all faces in an image via the local sidecar.
export async function embedLocally(imageBase64: string): Promise<DetectedFace[]> {
  let res: Response;
  try {
    res = await fetch(`${localEngineUrl()}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    });
  } catch {
    throw new LocalEngineError(UNREACHABLE);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LocalEngineError(`Face engine error ${res.status}: ${detail.slice(0, 160)}`);
  }
  const data = (await res.json()) as { faces?: DetectedFace[] };
  return data.faces ?? [];
}

// Liveness check for the local engine (used to show a clear status in the UI).
export async function localEngineReady(): Promise<boolean> {
  try {
    const res = await fetch(`${localEngineUrl()}/health`, { cache: 'no-store' });
    if (!res.ok) return false;
    const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return !!j?.ok;
  } catch {
    return false;
  }
}
