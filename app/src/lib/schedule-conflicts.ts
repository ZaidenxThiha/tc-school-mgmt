import { sql } from '@/lib/db';

type TeacherRole = 'MT' | 'CT';

export type ConflictInput = {
  month: string | null;
  day_of_week: string;
  time_slot: string;
  mt_employee_id: number | null;
  ct_employee_id: number | null;
  excludeId?: number;
};

export type ConflictRow = {
  id: number;
  mt_employee_id: number | null;
  ct_employee_id: number | null;
  class_label: string | null;
  subject: string | null;
  room_id: number | null;
};

export type TeacherConflict = {
  employee_id: number;
  inputRole: TeacherRole;
  other: ConflictRow;
  otherRole: TeacherRole;
};

function inputTeachers(input: ConflictInput) {
  return [
    input.mt_employee_id === null
      ? null
      : { employee_id: input.mt_employee_id, inputRole: 'MT' as const },
    input.ct_employee_id === null
      ? null
      : { employee_id: input.ct_employee_id, inputRole: 'CT' as const },
  ].filter((teacher): teacher is { employee_id: number; inputRole: TeacherRole } => teacher !== null);
}

export async function findTeacherConflicts(input: ConflictInput): Promise<TeacherConflict[]> {
  const teachers = inputTeachers(input);
  if (teachers.length === 0) return [];

  const monthCond = input.month === null ? sql`and month is null` : sql`and month = ${input.month}`;
  const excludeCond = input.excludeId !== undefined ? sql`and id <> ${input.excludeId}` : sql``;

  const rows = (await sql`
    select id, mt_employee_id, ct_employee_id, class_label, subject, room_id
    from schedule_assignments
    where day_of_week = ${input.day_of_week} and time_slot = ${input.time_slot} ${monthCond} ${excludeCond}
  `) as unknown as ConflictRow[];
  const conflicts: TeacherConflict[] = [];
  const seen = new Set<string>();

  for (const other of rows) {
    for (const teacher of teachers) {
      const matches: Array<{ otherRole: TeacherRole; employee_id: number | null }> = [
        { otherRole: 'MT', employee_id: other.mt_employee_id },
        { otherRole: 'CT', employee_id: other.ct_employee_id },
      ];

      for (const match of matches) {
        if (match.employee_id !== teacher.employee_id) continue;

        const key = `${teacher.employee_id}:${other.id}:${match.otherRole}`;
        if (seen.has(key)) continue;
        seen.add(key);

        conflicts.push({
          employee_id: teacher.employee_id,
          inputRole: teacher.inputRole,
          other,
          otherRole: match.otherRole,
        });
      }
    }
  }

  return conflicts;
}

function conflictLabel(row: ConflictRow) {
  return row.class_label?.trim() || row.subject?.trim() || '(no label)';
}

function teacherName(employeeId: number, employeeNames?: Map<number, string>) {
  const name = employeeNames?.get(employeeId)?.trim();
  return name || `#${employeeId}`;
}

function formatConflict(conflict: TeacherConflict, input: ConflictInput, employeeNames?: Map<number, string>) {
  return `Teacher conflict: ${teacherName(conflict.employee_id, employeeNames)} is already booked as ${conflict.otherRole} for ${input.day_of_week} ${input.time_slot} (${input.month ?? 'no month'}) on assignment #${conflict.other.id} "${conflictLabel(conflict.other)}". Change the teacher or the day/slot.`;
}

export async function assertNoTeacherConflicts(
  input: ConflictInput,
  employeeNames?: Map<number, string>,
): Promise<void> {
  const conflicts = await findTeacherConflicts(input);
  if (conflicts.length === 0) return;

  throw new Error(conflicts.map((conflict) => formatConflict(conflict, input, employeeNames)).join('\n'));
}
