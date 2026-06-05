import { auth } from '@/auth';
import { setStudentMark, setEmployeeAttendance, STUDENT_STATUSES } from '@/lib/attendance/correction';
import { audit } from '@/lib/audit';

// Programmatic manual correction (same logic the corrections-page server actions
// use). Admin-only.
const ADMIN = ['owner', 'admin'];

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user || !ADMIN.includes(user.role ?? '')) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const kind = body.kind;

    if (kind === 'student') {
      const sessionId = Number(body.sessionId);
      const studentId = Number(body.studentId);
      const status = String(body.status ?? '');
      if (!Number.isInteger(sessionId) || !Number.isInteger(studentId) || !STUDENT_STATUSES.includes(status as (typeof STUDENT_STATUSES)[number])) {
        return Response.json({ error: 'sessionId, studentId and a valid status are required.' }, { status: 400 });
      }
      await setStudentMark({ sessionId, studentId, status, markedBy: user.id ?? null });
      await audit({ table: 'attendance_marks', action: 'attendance_correction', rowId: `${sessionId}:${studentId}`, diff: { status } });
      return Response.json({ ok: true });
    }

    if (kind === 'employee') {
      const employeeId = Number(body.employeeId);
      const attendanceDate = String(body.attendanceDate ?? '');
      if (!Number.isInteger(employeeId) || !/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
        return Response.json({ error: 'employeeId and attendanceDate (YYYY-MM-DD) are required.' }, { status: 400 });
      }
      await setEmployeeAttendance({
        employeeId,
        attendanceDate,
        checkInTime: (body.checkInTime as string) ?? null,
        checkOutTime: (body.checkOutTime as string) ?? null,
        status: (body.status as string) ?? null,
      });
      await audit({ table: 'employee_attendance', action: 'attendance_correction', rowId: `${employeeId}:${attendanceDate}`, diff: body });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'kind must be "student" or "employee".' }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
