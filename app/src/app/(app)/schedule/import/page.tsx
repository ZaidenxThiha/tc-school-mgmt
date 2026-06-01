'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import { parseCsv, parseTimetable, type ParsedClass } from '@/lib/parse-timetable';
import { importTimetable, type ImportResult } from '@/lib/actions/timetable';

export default function ImportSchedulePage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`);
  const [parsed, setParsed] = useState<ParsedClass[]>([]);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setResult(null); setErr(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      setParsed(parseTimetable(parseCsv(text)));
    } catch {
      setErr('Could not read that file.');
      setParsed([]);
    }
  }

  function doImport() {
    setResult(null); setErr(null);
    if (parsed.length === 0) return;
    if (!confirm(`Import ${parsed.length} classes into ${month}? This REPLACES the existing schedule for that month.`)) return;
    start(async () => {
      try { setResult(await importTimetable(month, parsed)); }
      catch (e) { setErr(e instanceof Error ? e.message : 'Import failed'); }
    });
  }

  return (
    <div className="page max-w-5xl">
      <PageHeader title="Import schedule" subtitle="Upload the Class Schedule Template CSV"
        actions={<Link href="/schedule" className="btn-ghost">← Back to schedule</Link>} />

      <div className="card space-y-4">
        <div className="form-grid-2">
          <div>
            <label className="label">Target month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Timetable CSV</label>
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="input" />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Reads the room-block timetable grid (Class Name / Subject / MT / CT across 4 time-slots × Sat/Sun).
          Teacher, room and level names are matched automatically; unmatched ones are listed after import and left blank.
          <strong> Importing replaces all existing assignments for the chosen month.</strong>
        </p>
        {fileName && (
          <div className="text-sm">
            Parsed <strong>{parsed.length}</strong> classes from <span className="text-slate-500">{fileName}</span>.
            <button onClick={doImport} disabled={pending || parsed.length === 0} className="btn-primary ml-3">
              {pending ? 'Importing…' : `Import to ${month}`}
            </button>
          </div>
        )}
        {err && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
      </div>

      {result && (
        <div className="card mt-4 space-y-2">
          <div className="text-emerald-700 font-medium">✓ Imported {result.created} classes into {month}.</div>
          {result.unmatchedTeachers.length > 0 && (
            <p className="text-xs text-amber-700">Unmatched teachers (left blank): {result.unmatchedTeachers.join(', ')}</p>
          )}
          {result.unmatchedLevels.length > 0 && (
            <p className="text-xs text-amber-700">Unmatched levels (no section linked): {result.unmatchedLevels.join(', ')}</p>
          )}
          {result.unmatchedRooms.length > 0 && (
            <p className="text-xs text-amber-700">Unmatched rooms (left blank): {result.unmatchedRooms.join(', ')}</p>
          )}
          <Link href={`/schedule?month=${month}`} className="text-brand-600 hover:underline text-sm">View schedule →</Link>
        </div>
      )}

      {parsed.length > 0 && !result && (
        <div className="card p-0 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b font-medium text-sm">Preview ({parsed.length})</div>
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Day</th><th>Slot</th><th>Room</th><th>Level</th><th>Subject</th><th>MT</th><th>CT</th></tr></thead>
              <tbody>
                {parsed.map((c, i) => (
                  <tr key={i}>
                    <td>{c.day}</td><td>{c.time_slot}</td><td>{c.room}</td>
                    <td>{c.level}{c.online ? ' (Online)' : ''}</td><td className="text-xs">{c.subject}</td>
                    <td>{c.mt || '—'}</td><td>{c.ct || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
