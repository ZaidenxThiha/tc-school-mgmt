import { sql } from '@/lib/db';

// Read models for the attendance report pages and the CSV export route. Plain
// SQL over the existing tables; filtering is by the session date (students) or
// attendance date (employees).

export type StudentAttendanceRow = {
  session_date: string;
  student_id: number;
  student_name: string;
  section_id: number | null;
  level_name: string | null;
  time_slot: string | null;
  subject: string | null;
  status: string;
  confidence_score: number | null;
  source: string | null;
  scan_time: string | null;
};

export async function getStudentAttendance(filters: {
  from?: string;
  to?: string;
  status?: string;
  sectionId?: number;
}): Promise<StudentAttendanceRow[]> {
  const from = filters.from || null;
  const to = filters.to || null;
  const status = filters.status && filters.status !== 'all' ? filters.status : null;
  const sectionId = filters.sectionId ?? null;
  return (await sql`
    select to_char(cs.session_date, 'YYYY-MM-DD') as session_date,
           am.student_id,
           coalesce(s.english_name, s.myanmar_name, 'Student #' || am.student_id) as student_name,
           cs.section_id, l.name as level_name, sec.time_slot, am.subject,
           am.status, am.confidence_score, am.source,
           to_char(am.scan_time, 'YYYY-MM-DD HH24:MI') as scan_time
    from attendance_marks am
    join class_sessions cs on cs.id = am.session_id
    left join students s on s.id = am.student_id
    left join sections sec on sec.id = cs.section_id
    left join levels l on l.id = sec.level_id
    where (${from}::date is null or cs.session_date >= ${from})
      and (${to}::date is null or cs.session_date <= ${to})
      and (${status}::text is null or am.status = ${status})
      and (${sectionId}::int is null or cs.section_id = ${sectionId})
    order by cs.session_date desc, student_name
    limit 2000`) as unknown as StudentAttendanceRow[];
}

export type EmployeeAttendanceRow = {
  attendance_date: string;
  employee_id: number;
  employee_name: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
};

export async function getEmployeeAttendance(filters: { from?: string; to?: string }): Promise<EmployeeAttendanceRow[]> {
  const from = filters.from || null;
  const to = filters.to || null;
  return (await sql`
    select to_char(ea.attendance_date, 'YYYY-MM-DD') as attendance_date,
           ea.employee_id,
           coalesce(e.full_name, e.short_name, 'Employee #' || ea.employee_id) as employee_name,
           to_char(ea.check_in_time, 'YYYY-MM-DD HH24:MI') as check_in_time,
           to_char(ea.check_out_time, 'YYYY-MM-DD HH24:MI') as check_out_time,
           ea.status
    from employee_attendance ea
    left join employees e on e.id = ea.employee_id
    where (${from}::date is null or ea.attendance_date >= ${from})
      and (${to}::date is null or ea.attendance_date <= ${to})
    order by ea.attendance_date desc, employee_name
    limit 2000`) as unknown as EmployeeAttendanceRow[];
}

export type ScanLogRow = {
  id: number;
  person_id: number | null;
  person_type: string | null;
  person_name: string | null;
  match_status: string;
  confidence_score: number | null;
  reason: string | null;
  scanned_at: string;
};

// Generic scan-log fetch. `statuses` filters match_status; used for both the
// Failed/Unknown logs page and the Unassigned (no_active_class) page.
export async function getScanLogs(statuses: string[], limit = 500): Promise<ScanLogRow[]> {
  return (await sql`
    select sl.id, sl.person_id, sl.person_type,
           coalesce(s.english_name, s.myanmar_name, e.full_name, e.short_name) as person_name,
           sl.match_status, sl.confidence_score, sl.reason,
           to_char(sl.scanned_at, 'YYYY-MM-DD HH24:MI') as scanned_at
    from attendance_scan_logs sl
    left join students s on sl.person_type = 'student' and s.id = sl.person_id
    left join employees e on sl.person_type = 'employee' and e.id = sl.person_id
    where sl.match_status = any(${statuses})
    order by sl.scanned_at desc
    limit ${limit}`) as unknown as ScanLogRow[];
}
