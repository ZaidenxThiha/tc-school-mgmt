import Link from 'next/link';
import PageHeader from '@/components/page-header';
import AttendanceTabs from '@/components/attendance-tabs';
import { getStudentAttendance } from '@/lib/attendance/reports';

const STATUS_BADGE: Record<string, string> = {
  Present: 'badge-green',
  Late: 'badge-amber',
  Absent: 'badge-rose',
  Leave: 'badge-slate',
  Break: 'badge-slate',
};

export default async function StudentReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from ?? '';
  const to = sp.to ?? '';
  const status = sp.status ?? 'all';
  const rows = await getStudentAttendance({ from, to, status });

  const exportQs = new URLSearchParams({ type: 'student', from, to, status }).toString();

  return (
    <div className="page">
      <PageHeader
        title="Student Attendance"
        subtitle={`${rows.length.toLocaleString()} records`}
        actions={<Link href={`/api/attendance/export?${exportQs}`} className="btn-ghost text-sm">Export CSV</Link>}
      />
      <AttendanceTabs />

      <form className="flex flex-wrap items-end gap-2 mb-3 text-sm">
        <label className="space-y-1">
          <span className="text-slate-500 text-xs">From</span>
          <input name="from" type="date" defaultValue={from} className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-slate-500 text-xs">To</span>
          <input name="to" type="date" defaultValue={to} className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-slate-500 text-xs">Status</span>
          <select name="status" defaultValue={status} className="input">
            <option value="all">All</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="Leave">Leave</option>
            <option value="Break">Break</option>
          </select>
        </label>
        <button className="btn-ghost">Filter</button>
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Level</th>
                <th>Slot</th>
                <th>Subject</th>
                <th>Status</th>
                <th className="text-right">Conf.</th>
                <th>Source</th>
                <th>Scan time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.session_date}-${r.student_id}-${i}`}>
                  <td className="text-xs whitespace-nowrap tabular-nums">{r.session_date}</td>
                  <td>{r.student_name}</td>
                  <td className="text-xs text-slate-500">{r.level_name ?? '—'}</td>
                  <td className="text-xs text-slate-500">{r.time_slot ?? '—'}</td>
                  <td className="text-xs text-slate-500">{r.subject ?? '—'}</td>
                  <td><span className={STATUS_BADGE[r.status] ?? 'badge-slate'}>{r.status}</span></td>
                  <td className="text-right tabular-nums text-xs">{r.confidence_score != null ? `${(Number(r.confidence_score) * 100).toFixed(0)}%` : '—'}</td>
                  <td className="text-xs text-slate-500">{r.source ?? '—'}</td>
                  <td className="text-xs text-slate-500">{r.scan_time ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="text-center text-sm text-slate-400 py-6">No attendance records for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
