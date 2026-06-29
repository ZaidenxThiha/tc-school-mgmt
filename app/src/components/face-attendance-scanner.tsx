'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { embedLocally, ensureLocalEngine, LocalEngineError } from '@/lib/face/browser';

type RecognizeFace = {
  bbox: [number, number, number, number];
  det_score: number;
  status: 'recognized' | 'unknown' | 'low_confidence';
  match: { personId: number; personType: string; name: string; similarity: number } | null;
};

type RecordResult = {
  personId: number;
  personType: string;
  name: string;
  similarity: number;
  status: string;
  detail?: string;
};

const STATUS_BADGE: Record<string, string> = {
  present: 'badge-green',
  late: 'badge-amber',
  checked_in: 'badge-green',
  checked_out: 'badge-slate',
  already_recorded: 'badge-slate',
  already_completed: 'badge-slate',
  cooldown: 'badge-slate',
  no_active_class: 'badge-amber',
  failed: 'badge-rose',
};

const STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  already_recorded: 'Already recorded',
  already_completed: 'Already completed',
  cooldown: 'Already recorded',
  no_active_class: 'No active class',
  failed: 'Failed',
};

const personKey = (p: { personId: number; personType: string }) => `${p.personType}:${p.personId}`;

export default function FaceAttendanceScanner({
  cooldownSeconds,
  intervalMs = 2500,
  deviceId,
}: {
  cooldownSeconds: number;
  intervalMs?: number;
  deviceId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cacheRef = useRef<Map<string, number>>(new Map()); // personKey -> last sent ms
  const inFlight = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unknownCount, setUnknownCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Recorded people this session, newest status wins, keyed by person.
  const [records, setRecords] = useState<Map<string, RecordResult>>(new Map());

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      await ensureLocalEngine();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
    } catch (e) {
      setError(e instanceof LocalEngineError ? e.message : 'Could not access the camera. Check browser permissions.');
    } finally {
      setBusy(false);
    }
  }

  const drawBoxes = useCallback((faces: RecognizeFace[]) => {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    if (!video || !canvas) return;
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = video.videoWidth ? canvas.width / video.videoWidth : 1;
    const sy = video.videoHeight ? canvas.height / video.videoHeight : 1;
    ctx.lineWidth = 2;
    ctx.font = '14px system-ui, sans-serif';
    for (const f of faces) {
      const [x, y, w, h] = f.bbox;
      const known = f.status === 'recognized' && f.match;
      ctx.strokeStyle = known ? '#16a34a' : '#dc2626';
      ctx.fillStyle = known ? '#16a34a' : '#dc2626';
      ctx.strokeRect(x * sx, y * sy, w * sx, h * sy);
      const label = known ? `${f.match!.name} ${(f.match!.similarity * 100).toFixed(0)}%` : 'Unknown';
      ctx.fillText(label, x * sx, Math.max(12, y * sy - 4));
    }
  }, []);

  // Periodic scan loop.
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;

    async function tick() {
      if (inFlight.current || cancelled) return;
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        // Embed this frame on the LOCAL engine (runs on this laptop); only the
        // embeddings — never the image — are sent to the server for matching.
        const detected = await embedLocally(image);
        if (cancelled) return;

        const res = await fetch('/api/face-recognition/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faces: detected }),
        });
        if (!res.ok) {
          if (res.status === 429) return; // throttled; skip this frame
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `Recognition failed (${res.status}).`);
          return;
        }
        setError(null);
        const data = (await res.json()) as { faces: RecognizeFace[] };
        if (cancelled) return;
        drawBoxes(data.faces);
        setUnknownCount(data.faces.filter((f) => f.status !== 'recognized').length);

        // Decide who to record: recognized + not in frontend cooldown.
        const now = Date.now();
        const cooldownMs = cooldownSeconds * 1000;
        const toRecord = data.faces
          .filter((f) => f.status === 'recognized' && f.match)
          .map((f) => f.match!)
          .filter((m) => {
            const k = personKey(m);
            const last = cacheRef.current.get(k) ?? 0;
            return now - last > cooldownMs;
          });

        if (toRecord.length > 0) {
          // Optimistically mark cache so the next frame doesn't re-send.
          toRecord.forEach((m) => cacheRef.current.set(personKey(m), now));
          const recRes = await fetch('/api/attendance/face-record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              people: toRecord.map((m) => ({ personId: m.personId, personType: m.personType, similarity: m.similarity })),
              deviceId,
            }),
          });
          if (recRes.ok) {
            const out = (await recRes.json()) as { results: RecordResult[] };
            if (!cancelled) {
              setRecords((prev) => {
                const next = new Map(prev);
                for (const r of out.results) next.set(personKey(r), r);
                return next;
              });
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof LocalEngineError ? e.message : 'Network error during scan.');
      } finally {
        inFlight.current = false;
        if (!cancelled) setBusy(false);
      }
    }

    const id = setInterval(tick, intervalMs);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [scanning, intervalMs, cooldownSeconds, deviceId, drawBoxes]);

  const recordList = Array.from(records.values()).reverse();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-md border border-slate-200 bg-slate-900/5">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Camera off</div>
          )}
          {busy && scanning && (
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-xs text-slate-600">
              <Loader2 size={12} className="animate-spin" /> scanning…
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!scanning ? (
            <button type="button" onClick={start} disabled={busy} className="btn-primary text-sm">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {busy ? 'Starting engine…' : 'Start scanning'}
            </button>
          ) : (
            <button type="button" onClick={stop} className="btn-ghost text-sm">
              <CameraOff size={14} /> Stop
            </button>
          )}
          <span className="text-xs text-slate-500">Unknown faces in view: {unknownCount}</span>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-medium text-sm">Recorded this session ({records.size})</div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th className="text-right">Conf.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recordList.map((r) => (
                <tr key={personKey(r)}>
                  <td>{r.name}</td>
                  <td className="capitalize text-xs text-slate-500">{r.personType}</td>
                  <td className="text-right tabular-nums text-xs">{(r.similarity * 100).toFixed(0)}%</td>
                  <td>
                    <span className={STATUS_BADGE[r.status] ?? 'badge-slate'}>{STATUS_LABEL[r.status] ?? r.status}</span>
                    {r.detail && r.status === 'no_active_class' && (
                      <span className="ml-1 text-xs text-slate-400">{r.detail}</span>
                    )}
                  </td>
                </tr>
              ))}
              {records.size === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-sm text-slate-400 py-6">
                    No one recorded yet. Start scanning.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
