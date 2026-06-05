'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import { setStudentMark, setEmployeeAttendance, STUDENT_STATUSES } from '@/lib/attendance/correction';
import { audit } from '@/lib/audit';

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

const StudentCorrection = z.object({
  sessionId: z.coerce.number().int().positive(),
  studentId: z.coerce.number().int().positive(),
  status: z.enum(STUDENT_STATUSES),
});

// Manually set / override a student's mark for a session (corrections page).
export async function correctStudentMarkAction(formData: FormData): Promise<void> {
  await requireRole(WRITE_ADMIN);
  const c = StudentCorrection.parse({
    sessionId: formData.get('sessionId'),
    studentId: formData.get('studentId'),
    status: formData.get('status'),
  });
  await setStudentMark({ ...c, markedBy: await currentUserId() });
  await audit({ table: 'attendance_marks', action: 'attendance_correction', rowId: `${c.sessionId}:${c.studentId}`, diff: c });
  revalidatePath('/attendance/reports');
  revalidatePath('/attendance/corrections');
}

const EmployeeCorrection = z.object({
  employeeId: z.coerce.number().int().positive(),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  status: z.enum(['present', 'incomplete', 'completed', 'absent']).optional(),
});

// Manually set / override an employee's daily attendance (corrections page).
export async function correctEmployeeAttendanceAction(formData: FormData): Promise<void> {
  await requireRole(WRITE_ADMIN);
  const c = EmployeeCorrection.parse({
    employeeId: formData.get('employeeId'),
    attendanceDate: formData.get('attendanceDate'),
    checkInTime: formData.get('checkInTime') || undefined,
    checkOutTime: formData.get('checkOutTime') || undefined,
    status: formData.get('status') || undefined,
  });
  await setEmployeeAttendance({
    employeeId: c.employeeId,
    attendanceDate: c.attendanceDate,
    checkInTime: c.checkInTime ?? null,
    checkOutTime: c.checkOutTime ?? null,
    status: c.status ?? null,
  });
  await audit({ table: 'employee_attendance', action: 'attendance_correction', rowId: `${c.employeeId}:${c.attendanceDate}`, diff: c });
  revalidatePath('/attendance/employee-reports');
  revalidatePath('/attendance/corrections');
}
