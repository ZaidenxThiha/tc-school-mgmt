import { auth } from '@/auth';
import PageHeader from '@/components/page-header';
import AttendanceTabs from '@/components/attendance-tabs';
import SubmitButton from '@/components/submit-button';
import { correctStudentMarkAction, correctEmployeeAttendanceAction } from '@/lib/actions/attendance';

// Admin manual correction. Identifiers are entered directly (session/student or
// employee/date) — look them up from the Reports tables, which show the ids.
export default async function CorrectionsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (role !== 'owner' && role !== 'admin') {
    return (
      <div className="page-narrow">
        <PageHeader title="Manual Correction" />
        <AttendanceTabs />
        <div className="card text-sm text-rose-700">Admin role required.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Manual Correction" subtitle="Fix or override attendance that the camera missed or got wrong." />
      <AttendanceTabs />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="font-medium mb-3">Student mark</div>
          <form action={correctStudentMarkAction} className="space-y-3 text-sm">
            <label className="space-y-1 block">
              <span className="text-slate-500 text-xs">Session ID</span>
              <input name="sessionId" type="number" min="1" required className="input" />
            </label>
            <label className="space-y-1 block">
              <span className="text-slate-500 text-xs">Student ID</span>
              <input name="studentId" type="number" min="1" required className="input" />
            </label>
            <label className="space-y-1 block">
              <span className="text-slate-500 text-xs">Status</span>
              <select name="status" className="input" defaultValue="Present">
                <option>Present</option>
                <option>Late</option>
                <option>Absent</option>
                <option>Leave</option>
                <option>Break</option>
              </select>
            </label>
            <SubmitButton>Save student mark</SubmitButton>
          </form>
        </section>

        <section className="card">
          <div className="font-medium mb-3">Employee attendance</div>
          <form action={correctEmployeeAttendanceAction} className="space-y-3 text-sm">
            <label className="space-y-1 block">
              <span className="text-slate-500 text-xs">Employee ID</span>
              <input name="employeeId" type="number" min="1" required className="input" />
            </label>
            <label className="space-y-1 block">
              <span className="text-slate-500 text-xs">Date</span>
              <input name="attendanceDate" type="date" required className="input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-slate-500 text-xs">Check in</span>
                <input name="checkInTime" type="datetime-local" className="input" />
              </label>
              <label className="space-y-1 block">
                <span className="text-slate-500 text-xs">Check out</span>
                <input name="checkOutTime" type="datetime-local" className="input" />
              </label>
            </div>
            <label className="space-y-1 block">
              <span className="text-slate-500 text-xs">Status</span>
              <select name="status" className="input" defaultValue="completed">
                <option value="present">present</option>
                <option value="incomplete">incomplete</option>
                <option value="completed">completed</option>
                <option value="absent">absent</option>
              </select>
            </label>
            <SubmitButton>Save employee attendance</SubmitButton>
          </form>
        </section>
      </div>
    </div>
  );
}
