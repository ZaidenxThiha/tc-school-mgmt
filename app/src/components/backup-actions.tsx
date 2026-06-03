'use client';

import { useState, useTransition } from 'react';
import { Download, Upload, RotateCcw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function BackupActions() {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);

  function downloadBackup() {
    setMsg(null);
    start(async () => {
      try {
        const res = await fetch('/api/backup/export');
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        a.href = url;
        a.download = `tnc-backup-${ts}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMsg({ kind: 'ok', text: 'Backup downloaded.' });
      } catch (e) {
        setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  function performRestore() {
    if (!file) { setMsg({ kind: 'err', text: 'Pick a backup file first.' }); return; }
    if (!pw) { setMsg({ kind: 'err', text: 'Enter your account password to confirm.' }); return; }
    setMsg(null);
    start(async () => {
      try {
        const form = new FormData();
        form.set('file', file);
        form.set('password', pw);
        const res = await fetch('/api/backup/restore', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Restore failed.');
        setMsg({ kind: 'ok', text: `Restored ${Number(data.restored ?? 0).toLocaleString()} rows. Refresh to see updates.` });
        setRestoreOpen(false); setPw(''); setFile(null);
      } catch (e) {
        setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="card flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="font-semibold mb-1">Download backup</div>
          <p className="text-xs text-slate-500">Generates a JSON file of every row in every data table.</p>
        </div>
        <button onClick={downloadBackup} disabled={busy} className="btn-primary inline-flex items-center gap-2">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Download
        </button>
      </div>

      <div className="card">
        <div className="flex items-start gap-4 flex-wrap mb-3">
          <div className="flex-1 min-w-[220px]">
            <div className="font-semibold mb-1">Restore from file</div>
            <p className="text-xs text-rose-600">⚠ Truncates every table before reload. Owner password required.</p>
          </div>
          <button
            onClick={() => { setRestoreOpen((o) => !o); setMsg(null); }}
            className="btn-ghost inline-flex items-center gap-2"
          >
            <Upload size={14} /> {restoreOpen ? 'Cancel' : 'Restore'}
          </button>
        </div>
        {restoreOpen && (
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <div>
              <label className="label">Backup file (.json)</label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="input"
              />
              {file && <div className="text-xs text-slate-500 mt-1">Selected: {file.name} · {(file.size / 1024).toFixed(0)} KB</div>}
            </div>
            <div>
              <label className="label">Confirm with your account password</label>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Your login password"
                autoComplete="current-password"
                className="input max-w-xs"
              />
            </div>
            <button
              onClick={performRestore}
              disabled={busy || !file}
              className="btn-primary bg-rose-600 hover:bg-rose-700 inline-flex items-center gap-2"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Restore now
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className={`card flex items-start gap-2 text-sm ${msg.kind === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-rose-300 bg-rose-50 text-rose-900'}`}>
          {msg.kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
