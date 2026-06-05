import { auth } from '@/auth';
import { toCsv, csvResponse, type CsvColumn } from '@/lib/csv';
import {
  getStudentAttendance,
  getEmployeeAttendance,
  type StudentAttendanceRow,
  type EmployeeAttendanceRow,
} from '@/lib/attendance/reports';

// CSV export of attendance reports. ?type=student|employee plus the same filters
// the report pages use (from, to, status, section).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'student';
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;

  if (type === 'employee') {
    const rows = await getEmployeeAttendance({ from, to });
    const cols: CsvColumn<EmployeeAttendanceRow>[] = [
      { key: 'attendance_date', label: 'Date', value: (r) => r.attendance_date },
      { key: 'employee_name', label: 'Employee', value: (r) => r.employee_name },
      { key: 'check_in_time', label: 'Check in', value: (r) => r.check_in_time ?? '' },
      { key: 'check_out_time', label: 'Check out', value: (r) => r.check_out_time ?? '' },
      { key: 'status', label: 'Status', value: (r) => r.status },
    ];
    return csvResponse(toCsv(rows, cols), `employee-attendance-${from ?? 'all'}.csv`);
  }

  const status = url.searchParams.get('status') ?? undefined;
  const sectionId = url.searchParams.get('section') ? Number(url.searchParams.get('section')) : undefined;
  const rows = await getStudentAttendance({ from, to, status, sectionId });
  const cols: CsvColumn<StudentAttendanceRow>[] = [
    { key: 'session_date', label: 'Date', value: (r) => r.session_date },
    { key: 'student_name', label: 'Student', value: (r) => r.student_name },
    { key: 'level_name', label: 'Level', value: (r) => r.level_name ?? '' },
    { key: 'time_slot', label: 'Slot', value: (r) => r.time_slot ?? '' },
    { key: 'subject', label: 'Subject', value: (r) => r.subject ?? '' },
    { key: 'status', label: 'Status', value: (r) => r.status },
    { key: 'confidence_score', label: 'Confidence', value: (r) => r.confidence_score ?? '' },
    { key: 'source', label: 'Source', value: (r) => r.source ?? '' },
    { key: 'scan_time', label: 'Scan time', value: (r) => r.scan_time ?? '' },
  ];
  return csvResponse(toCsv(rows, cols), `student-attendance-${from ?? 'all'}.csv`);
}
