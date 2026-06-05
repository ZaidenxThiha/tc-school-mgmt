'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import FaceCapture from '@/components/face-capture';
import { embedLocally, LocalEngineError } from '@/lib/face/browser';
import type { ComboOption } from '@/components/student-combobox';

// Admin "Record Face" form: pick a student or employee, capture/upload a single
// face, POST to /api/face-profiles (embedding only — no photo stored).
export default function FaceRegisterForm({
  students,
  employees,
}: {
  students: ComboOption[];
  employees: ComboOption[];
}) {
  const router = useRouter();
  const [personType, setPersonType] = useState<'student' | 'employee'>('student');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const options = personType === 'student' ? students : employees;
  const term = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options).slice(0, 30),
    [options, term],
  );

  function pickType(t: 'student' | 'employee') {
    setPersonType(t);
    setSelectedId('');
    setQuery('');
  }

  async function submit() {
    if (!selectedId || !image) {
      setMsg({ kind: 'err', text: 'Pick a person and capture a face first.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      // Embed on the LOCAL engine in this browser — the image never leaves this
      // laptop; only the embedding is sent to the server.
      const faces = await embedLocally(image);
      if (faces.length === 0) {
        setMsg({ kind: 'err', text: 'No face detected.' });
        return;
      }
      if (faces.length > 1) {
        setMsg({ kind: 'err', text: 'Multiple faces detected. Please use a single-face photo.' });
        return;
      }
      const res = await fetch('/api/face-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: selectedId, personType, face: faces[0] }),
      });
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error ?? 'Registration failed.' });
      } else {
        setMsg({ kind: 'ok', text: 'Face registered.' });
        setImage(null);
        setSelectedId('');
        setQuery('');
        router.refresh();
      }
    } catch (e) {
      const text = e instanceof LocalEngineError ? e.message : 'Network error. Please try again.';
      setMsg({ kind: 'err', text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['student', 'employee'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => pickType(t)}
            className={personType === t ? 'btn-primary text-sm capitalize' : 'btn-ghost text-sm capitalize'}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <input
          type="text"
          autoComplete="off"
          className="input"
          placeholder={`Search ${personType}…`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId('');
          }}
        />
        {query && !selectedId && filtered.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseDown={() => {
                    setSelectedId(o.id);
                    setQuery(o.label);
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-slate-50"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FaceCapture onCapture={setImage} disabled={busy} />

      {msg && <p className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}

      <button type="button" onClick={submit} disabled={busy || !selectedId || !image} className="btn-primary">
        {busy && <Loader2 size={14} className="animate-spin" />}
        {busy ? 'Saving…' : 'Save face'}
      </button>
    </div>
  );
}
