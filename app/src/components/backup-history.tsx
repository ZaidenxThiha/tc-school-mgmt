'use client';

import { useEffect, useState, useTransition } from 'react';
import { Download, RotateCcw, Trash2, Loader2, RefreshCcw, Plus } from 'lucide-react';
import {
  listBackupsAction,
  createBackupAction,
  deleteBackupAction,
  restoreFromBackupAction,
} from '@/lib/actions/backup';
import type { BackupRow } from '@/lib/backup';

export default function BackupHistory() {
  const [rows, setRows] = useState<BackupRow[]>([]);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function refresh() {
    setMsg(null);
    try {
      setRows(await listBackupsAction());
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    }
  }
  useEffect(() => { refresh(); }, []);

  function downloadById(id: number) {
    // Stored payloads are large — stream them from the route as a file download.
    window.location.href = `/api/backup/${id}`;
  }

  function restoreById(id: number) {
    const pw = window.prompt('Enter YOUR account password to confirm. This truncates every table first.');
    if (!pw) { setMsg({ kind: 'err', text: 'Cancelled.' }); return; }
    setMsg(null);
    start(async () => {
      try {
        const n = await restoreFromBackupAction(id, pw);
        setMsg({ kind: 'ok', text: `Restored ${Number(n).toLocaleString()} rows from backup #${id}.` });
        await refresh();
      } catch (e) {
        setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  function deleteById(id: number) {
    if (!window.confirm(`Delete backup #${id}?`)) return;
    setMsg(null);
    start(async () => {
      try {
        await deleteBackupAction(id);
        setMsg({ kind: 'ok', text: `Deleted backup #${id}.` });
        await refresh();
      } catch (e) {
        setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  function backupNow() {
    setMsg(null);
    start(async () => {
      try {
        const id = await createBackupAction('manual via UI');
        setMsg({ kind: 'ok', text: `Backup #${id} created.` });
        await refresh();
      } catch (e) {
        setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-semibold">Backup history</div>
          <div className="text-xs text-slate-500">Auto-snapshot per schedule below · last 30 auto + 50 manual kept</div>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={busy} className="btn-ghost text-xs inline-flex items-center gap-1">
            <RefreshCcw size={12} /> Refresh
          </button>
          <button onClick={backupNow} disabled={busy} className="btn-primary text-xs inline-flex items-center gap-1">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Backup now
          </button>
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-2 text-xs ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
          {msg.text}
        </div>
      )}

      <div className="table-scroll">
        <table className="table">
          <thead><tr><th>#</th><th>When</th><th>Source</th><th>Rows</th><th>Size</th><th>Notes</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="text-slate-400 tabular-nums">{b.id}</td>
                <td className="text-xs">{new Date(b.created_at).toLocaleString('en-GB')}</td>
                <td><span className={b.source === 'auto' ? 'badge-amber' : 'badge-slate'}>{b.source}</span></td>
                <td className="tabular-nums">{Number(b.row_count ?? 0).toLocaleString()}</td>
                <td className="tabular-nums text-xs">{(Number(b.size_bytes ?? 0) / 1024).toFixed(0)} KB</td>
                <td className="text-xs text-slate-500 max-w-[180px] truncate" title={b.notes ?? ''}>{b.notes ?? '—'}</td>
                <td className="text-right whitespace-nowrap">
                  <button onClick={() => downloadById(b.id)} disabled={busy} className="text-brand-600 hover:underline text-xs mr-3 inline-flex items-center gap-1">
                    <Download size={11} /> Download
                  </button>
                  <button onClick={() => restoreById(b.id)} disabled={busy} className="text-amber-600 hover:underline text-xs mr-3 inline-flex items-center gap-1">
                    <RotateCcw size={11} /> Restore
                  </button>
                  <button onClick={() => deleteById(b.id)} disabled={busy} className="text-rose-600 hover:underline text-xs inline-flex items-center gap-1">
                    <Trash2 size={11} /> Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No backups yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
