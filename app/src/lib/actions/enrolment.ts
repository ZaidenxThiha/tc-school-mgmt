'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

// Enroll a student into a section. Blocks duplicate open enrolments and
// over-capacity sections so the roster stays meaningful.
export async function createEnrolment(formData: FormData) {
  const parsed = EnrolmentSchema.parse(fields(formData));
  const supabase = await createClient();

  const back = (reason: string) =>
    redirect(`/enrolments/new?section=${parsed.section_id}&student=${parsed.student_id}&error=${reason}`);

  // One open enrolment per student per section.
  const { data: dup } = await supabase
    .from('enrolments')
    .select('id')
    .eq('student_id', parsed.student_id)
    .eq('section_id', parsed.section_id)
    .is('end_date', null)
    .maybeSingle();
  if (dup) back('duplicate');

  // Capacity guard (only when the section declares a capacity). Count every
  // open enrolment (end_date IS NULL), independent of student status, so the
  // guard can't be bypassed by enrolling a non-active student.
  const [{ data: section }, { count: openCount }] = await Promise.all([
    supabase.from('sections').select('capacity').eq('id', parsed.section_id).single(),
    supabase.from('enrolments').select('id', { count: 'exact', head: true })
      .eq('section_id', parsed.section_id).is('end_date', null),
  ]);
  const cap = section?.capacity ?? null;
  if (cap && (openCount ?? 0) >= cap) back('full');

  const { error } = await supabase.from('enrolments').insert({
    student_id: parsed.student_id,
    section_id: parsed.section_id,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    status: parsed.status,
  });
  if (error) throw new Error(error.message);

  // Enrolling as Active implies the student is active — flip them so they show
  // up in the section roster and active counts (which key off student status).
  if (parsed.status === 'Active') {
    await supabase.from('students')
      .update({ current_status: 'Active', updated_at: new Date().toISOString() })
      .eq('id', parsed.student_id)
      .neq('current_status', 'Active');
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
  const supabase = await createClient();

  // Closing an enrolment (Left) implies an end date; default to today if blank.
  const end_date = parsed.status === 'Left' ? (parsed.end_date ?? new Date().toISOString().slice(0, 10)) : parsed.end_date;

  const { error } = await supabase
    .from('enrolments')
    .update({ start_date: parsed.start_date, end_date, status: parsed.status })
    .eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/enrolments');
  redirect('/enrolments');
}
