'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';

const STATUSES = ['Active', 'Break', 'Left'] as const;

const EnrolmentSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  section_id: z.coerce.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.enum(STATUSES),
});

function fields(formData: FormData) {
  return {
    student_id: formData.get('student_id'),
    section_id: formData.get('section_id'),
    start_date: String(formData.get('start_date') ?? ''),
    end_date: String(formData.get('end_date') ?? '') || null,
    status: String(formData.get('status') ?? 'Active'),
  };
}

export async function createEnrolment(formData: FormData) {
  const parsed = EnrolmentSchema.parse(fields(formData));
  await requireRole(WRITE_ADMIN);

  const back = (reason: string) =>
    redirect(`/enrolments/new?section=${parsed.section_id}&student=${parsed.student_id}&error=${reason}`);

  const dup = await sql`select id from enrolments where student_id = ${parsed.student_id} and section_id = ${parsed.section_id} and end_date is null limit 1`;
  if (dup[0]) back('duplicate');

  const [secRows, openRows] = await Promise.all([
    sql`select capacity from sections where id = ${parsed.section_id}`,
    sql`select count(*)::int as n from enrolments where section_id = ${parsed.section_id} and end_date is null`,
  ]);
  const cap = secRows[0]?.capacity ?? null;
  if (cap && (openRows[0]?.n ?? 0) >= cap) back('full');

  await sql`
    insert into enrolments (student_id, section_id, start_date, end_date, status)
    values (${parsed.student_id}, ${parsed.section_id}, ${parsed.start_date}, ${parsed.end_date ?? null}, ${parsed.status})`;

  if (parsed.status === 'Active') {
    await sql`update students set current_status = 'Active', updated_at = now() where id = ${parsed.student_id} and current_status <> 'Active'`;
  }

  revalidatePath('/enrolments');
  revalidatePath('/students');
  revalidatePath(`/sections/${parsed.section_id}`);
  redirect(`/sections/${parsed.section_id}`);
}

const SaveSchema = EnrolmentSchema.pick({ start_date: true, end_date: true, status: true });

export async function saveEnrolment(id: number, formData: FormData) {
  const parsed = SaveSchema.parse({
    start_date: String(formData.get('start_date') ?? ''),
    end_date: String(formData.get('end_date') ?? '') || null,
    status: String(formData.get('status') ?? 'Active'),
  });
  await requireRole(WRITE_ADMIN);

  const end_date = parsed.status === 'Left' ? (parsed.end_date ?? new Date().toISOString().slice(0, 10)) : (parsed.end_date ?? null);

  await sql`update enrolments set start_date = ${parsed.start_date}, end_date = ${end_date}, status = ${parsed.status} where id = ${id}`;

  revalidatePath('/enrolments');
  redirect('/enrolments');
}
