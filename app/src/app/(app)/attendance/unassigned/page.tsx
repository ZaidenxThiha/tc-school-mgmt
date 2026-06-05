import PageHeader from '@/components/page-header';
import AttendanceTabs from '@/components/attendance-tabs';
import { getScanLogs } from '@/lib/attendance/reports';

// Recognized people who were scanned while no class/session was active for them.
export default async function UnassignedPage() {
  const rows = await getScanLogs(['no_active_class']);
  return (
    <div className="page">
      <PageHeader title="Unassigned Attendance" subtitle="Recognized, but no active class found at scan time." />
      <AttendanceTabs />
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Person</th>
                <th>Type</th>
                <th className="text-right">Conf.</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs whitespace-nowrap tabular-nums">{r.scanned_at}</td>
                  <td>{r.person_name ?? (r.person_id != null ? `#${r.person_id}` : '—')}</td>
                  <td className="capitalize text-xs text-slate-500">{r.person_type ?? '—'}</td>
                  <td className="text-right tabular-nums text-xs">{r.confidence_score != null ? `${(Number(r.confidence_score) * 100).toFixed(0)}%` : '—'}</td>
                  <td className="text-xs text-slate-500">{r.reason ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center text-sm text-slate-400 py-6">No unassigned scans.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
