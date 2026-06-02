'use client';

import { useEffect, useState, useTransition } from 'react';
import { Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getFrequencyAction, setFrequencyAction } from '@/lib/actions/backup';
import type { Frequency } from '@/lib/backup';

const LABEL: Record<Frequency, string> = {
  daily:  'Daily — 02:00 UTC (08:30 Mandalay)',
  weekly: 'Weekly — Sunday 02:00 UTC',
  hourly: 'Hourly — top of every hour',
};

export default function BackupSchedule() {
  const [freq, setFreq] = useState<Frequency>('daily');
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function load() {
    try {
      setFreq(await getFrequencyAction());
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    }
  }
  useEffect(() => { load(); }, []);

  function save(newFreq: Frequency) {
    setMsg(null);
    start(async () => {
      try {
        setFreq(await setFrequencyAction(newFreq));
        setMsg({ kind: 'ok', text: `Schedule set to ${LABEL[newFreq]}.` });
      } catch (e) {
        setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} className="text-slate-500" />
        <div className="font-semibold">Auto-backup schedule</div>
        {busy && <Loader2 size={14} className="animate-spin text-slate-400" />}
      </div>
      <div className="text-xs text-slate-500 mb-3">
        Current: <span className="font-medium text-slate-800">{LABEL[freq]}</span>
        <span className="ml-2 text-slate-400">· runs via Vercel Cron</span>
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-md">
        {(['daily', 'weekly', 'hourly'] as const).map((f) => (
          <button
            key={f}
            onClick={() => save(f)}
            disabled={busy || freq === f}
            className={`py-2 px-3 rounded-md border text-sm font-medium ${
              freq === f
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>
      {msg && (
        <div className={`mt-3 text-xs flex items-center gap-1 ${msg.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
          {msg.kind === 'ok' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {msg.text}
        </div>
      )}
    </div>
  );
}
