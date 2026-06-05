import { sql } from '@/lib/db';

// Manual attendance correction helpers, shared by the corrections server actions
// and the /api/attendance/manual-correction route. Status values follow the
// existing attendance_marks CHECK: Present | Absent | Leave | Break | Late.

export const STUDENT_STATUSES = ['Present', 'Late', 'Absent', 'Leave', 'Break'] as const;

export async function setStudentMark(opts: {
  sessionId: number;
  studentId: number;
  status: string;
  markedBy?: string | null;
}): Promise<void> {
  await sql`
    insert into attendance_marks (session_id, student_id, status, marked_at, marked_by, source)
    values (${opts.sessionId}, ${opts.studentId}, ${opts.status}, now(), ${opts.markedBy ?? null}, 'manual')
    on conflict (session_id, student_id)
      do update set status = excluded.status, marked_at = now(),
                    marked_by = excluded.marked_by, source = 'manual'`;
}

export async function setEmployeeAttendance(opts: {
  employeeId: number;
  attendanceDate: string; // YYYY-MM-DD
  checkInTime?: string | null; // ISO or null to leave unchanged
  checkOutTime?: string | null;
  status?: string | null;
}): Promise<void> {
  await sql`
    insert into employee_attendance (employee_id, attendance_date, check_in_time, check_out_time, status)
    values (${opts.employeeId}, ${opts.attendanceDate}, ${opts.checkInTime ?? null},
            ${opts.checkOutTime ?? null}, ${opts.status ?? 'present'})
    on conflict (employee_id, attendance_date)
      do update set
        check_in_time  = coalesce(${opts.checkInTime ?? null}, employee_attendance.check_in_time),
        check_out_time = coalesce(${opts.checkOutTime ?? null}, employee_attendance.check_out_time),
        status         = coalesce(${opts.status ?? null}, employee_attendance.status),
        updated_at     = now()`;
}
