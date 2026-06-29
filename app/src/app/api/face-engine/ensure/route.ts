import { NextResponse } from 'next/server';
import { ensureFaceEngine } from '@/lib/face/autostart';

// Browser-direct scanning calls the local engine at 127.0.0.1:8000. When the
// Next.js app runs on the same laptop (local dev or self-hosted), this route
// spawns the Python sidecar if it isn't up yet. On Vercel it is a no-op.
export async function POST() {
  try {
    await ensureFaceEngine();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
