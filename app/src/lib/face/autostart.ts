import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Dev convenience: when a face operation runs (Save face / scan) and the local
// Python sidecar isn't up, launch it automatically so the operator never has to
// start uvicorn by hand. ONLY ever does this for a local (127.0.0.1/localhost)
// FACE_ENGINE_URL in non-production — on Vercel the sidecar is hosted elsewhere
// and this is a no-op.

let startPromise: Promise<void> | null = null;

function isLocal(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === '127.0.0.1' || h === 'localhost' || h === '::1';
  } catch {
    return false;
  }
}

async function healthOk(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/health`, { cache: 'no-store' });
    if (!res.ok) return false;
    const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return !!j?.ok;
  } catch {
    return false;
  }
}

export async function ensureFaceEngine(): Promise<void> {
  const url = process.env.FACE_ENGINE_URL;
  const token = process.env.FACE_ENGINE_TOKEN;
  if (!url || !token) return; // not configured — embedImage throws its own clear error
  if (process.env.NODE_ENV === 'production' || !isLocal(url)) return; // never auto-spawn in prod
  if (await healthOk(url)) return; // already running
  if (startPromise) {
    await startPromise;
    return;
  }

  startPromise = launch(url, token).finally(() => {
    startPromise = null;
  });
  await startPromise;
}

async function launch(url: string, token: string): Promise<void> {
  // Default to ../face-engine relative to the app cwd (next dev runs from app/).
  const engineDir = process.env.FACE_ENGINE_DIR ?? path.join(process.cwd(), '..', 'face-engine');
  const uvicorn = path.join(engineDir, '.venv', 'bin', 'uvicorn');
  if (!fs.existsSync(uvicorn)) {
    console.error(`[face-autostart] sidecar venv not found at ${uvicorn} — cannot auto-start. Run its install once.`);
    return;
  }
  const port = new URL(url).port || '8000';
  const log = fs.openSync(path.join(engineDir, 'engine.log'), 'a');
  console.error('[face-autostart] starting face-engine sidecar…');

  // Spawn token-less so the browser (browser-direct mode) can also call this
  // local engine; binding to 127.0.0.1 keeps it to this machine. `token` is only
  // used to gate the server-side path and is intentionally not passed here.
  void token;
  const child = spawn(uvicorn, ['main:app', '--host', '127.0.0.1', '--port', port], {
    cwd: engineDir,
    env: { ...process.env, FACE_ENGINE_TOKEN: '', FACE_CTX_ID: process.env.FACE_CTX_ID ?? '-1' },
    detached: true,
    stdio: ['ignore', log, log],
  });
  child.unref();

  // Poll until healthy. Model is cached after first run (~secs); allow generous
  // time for a cold first-ever model download.
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    if (await healthOk(url)) {
      console.error('[face-autostart] sidecar ready');
      return;
    }
  }
  console.error('[face-autostart] sidecar did not become ready within 120s');
}
