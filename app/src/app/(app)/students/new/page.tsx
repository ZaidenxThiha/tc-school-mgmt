import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';
import SubmitButton from '@/components/submit-button';


async function createStudent(formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);

  const phone = String(formData.get('phone') ?? '').trim();
  let guardianId: number | null = null;
  if (phone) {
    const g = await sql`
      insert into guardians (phone_primary, viber_number)
      values (${phone}, ${String(formData.get('viber') ?? '').trim() || null})
      returning id`;
    guardianId = g[0]?.id ?? null;
  }

  const student = await sql`
    insert into students (english_name, myanmar_name, current_status, enrolled_at, guardian_id)
    values (
      ${String(formData.get('english_name') ?? '').trim() || null},
      ${String(formData.get('myanmar_name') ?? '').trim() || null},
      ${String(formData.get('status') ?? 'Active')},
      ${String(formData.get('enrolled_at') ?? '') || null},
      ${guardianId}
    ) returning id`;

  redirect(`/students/${student[0].id}`);
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
