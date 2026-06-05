import Link from 'next/link';
import PageHeader from '@/components/page-header';
import AttendanceTabs from '@/components/attendance-tabs';
import { getEmployeeAttendance } from '@/lib/attendance/reports';

const STATUS_BADGE: Record<string, string> = {
  completed: 'badge-green',
  incomplete: 'badge-amber',
  present: 'badge-slate',
  absent: 'badge-rose',
};

export default async function EmployeeReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from ?? '';
  const to = sp.to ?? '';
  const rows = await getEmployeeAttendance({ from, to });
  const exportQs = new URLSearchParams({ type: 'employee', from, to }).toString();

  return (
    <div className="page">
      <PageHeader
        title="Employee Attendance"
        subtitle={`${rows.length.toLocaleString()} day records`}
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
        <button className="btn-ghost">Filter</button>
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.attendance_date}-${r.employee_id}-${i}`}>
                  <td className="text-xs whitespace-nowrap tabular-nums">{r.attendance_date}</td>
                  <td>{r.employee_name}</td>
                  <td className="text-xs tabular-nums">{r.check_in_time ?? '—'}</td>
                  <td className="text-xs tabular-nums">{r.check_out_time ?? '—'}</td>
                  <td><span className={STATUS_BADGE[r.status] ?? 'badge-slate'}>{r.status}</span></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center text-sm text-slate-400 py-6">No employee attendance for this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
