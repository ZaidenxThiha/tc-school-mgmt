import PageHeader from '@/components/page-header';
import AttendanceTabs from '@/components/attendance-tabs';
import { getScanLogs } from '@/lib/attendance/reports';

const BADGE: Record<string, string> = {
  unknown: 'badge-rose',
  low_confidence: 'badge-amber',
  duplicate: 'badge-slate',
  failed: 'badge-rose',
};

// Failed / unknown / low-confidence / duplicate scans — for admin review. No
// images are ever stored, only the outcome and score.
export default async function ScanLogsPage() {
  const rows = await getScanLogs(['unknown', 'low_confidence', 'duplicate', 'failed']);
  return (
    <div className="page">
      <PageHeader title="Scan Logs" subtitle="Unknown, low-confidence, duplicate and failed scans (no photos stored)." />
      <AttendanceTabs />
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Result</th>
                <th>Person</th>
                <th className="text-right">Conf.</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs whitespace-nowrap tabular-nums">{r.scanned_at}</td>
                  <td><span className={BADGE[r.match_status] ?? 'badge-slate'}>{r.match_status}</span></td>
                  <td>{r.person_name ?? (r.person_id != null ? `#${r.person_id}` : '—')}</td>
                  <td className="text-right tabular-nums text-xs">{r.confidence_score != null ? `${(Number(r.confidence_score) * 100).toFixed(0)}%` : '—'}</td>
                  <td className="text-xs text-slate-500">{r.reason ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center text-sm text-slate-400 py-6">No scan logs.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
