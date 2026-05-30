import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import SubmitButton from '@/components/submit-button';


async function createStudent(formData: FormData) {
  'use server';
  const supabase = await createClient();

  const phone = String(formData.get('phone') ?? '').trim();
  let guardianId: number | null = null;
  if (phone) {
    const { data: g } = await supabase
      .from('guardians')
      .insert({ phone_primary: phone, viber_number: String(formData.get('viber') ?? '').trim() || null })
      .select('id').single();
    guardianId = g?.id ?? null;
  }

  const { data: student, error } = await supabase
    .from('students')
    .insert({
      english_name: String(formData.get('english_name') ?? '').trim() || null,
      myanmar_name: String(formData.get('myanmar_name') ?? '').trim() || null,
      current_status: String(formData.get('status') ?? 'Active'),
      enrolled_at: String(formData.get('enrolled_at') ?? '') || null,
      guardian_id: guardianId,
    })
    .select('id').single();

  if (error) throw new Error(error.message);
  redirect(`/students/${student!.id}`);
}

export default function NewStudentPage() {
  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title="Add student" subtitle="Create a new student record" />
      <form action={createStudent} className="card space-y-4">
        <div className="form-grid-2">
          <div>
            <label className="label">English name</label>
            <input name="english_name" required className="input" />
          </div>
          <div>
            <label className="label">Myanmar name</label>
            <input name="myanmar_name" className="input" />
          </div>
          <div>
            <label className="label">Phone (guardian)</label>
            <input name="phone" className="input" placeholder="09…" />
          </div>
          <div>
            <label className="label">Viber</label>
            <input name="viber" className="input" />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input" defaultValue="Active">
              <option>Active</option>
              <option>Break</option>
              <option>Left</option>
              <option>Prospect</option>
            </select>
          </div>
          <div>
            <label className="label">Enrolled at</label>
            <input name="enrolled_at" type="date" className="input" />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/students" className="btn-ghost">Cancel</a>
          <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
        </div>
      </form>
    </div>
  );
}
