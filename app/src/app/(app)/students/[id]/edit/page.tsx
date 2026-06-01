import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';
import SubmitButton from '@/components/submit-button';
import { revalidatePath } from 'next/cache';


async function saveStudent(id: number, formData: FormData) {
  'use server';
  await requireRole(WRITE_ADMIN);
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const phone2 = String(formData.get('phone2') ?? '').trim() || null;
  const viber = String(formData.get('viber') ?? '').trim() || null;

  // Update or insert guardian
  const stu = await sql`select guardian_id from students where id = ${id}`;
  let guardianId: number | null = stu[0]?.guardian_id ?? null;
  if (phone || phone2 || viber) {
    if (guardianId) {
      await sql`update guardians set phone_primary=${phone}, phone_secondary=${phone2}, viber_number=${viber} where id=${guardianId}`;
    } else {
      const g = await sql`insert into guardians (phone_primary, phone_secondary, viber_number) values (${phone}, ${phone2}, ${viber}) returning id`;
      guardianId = g[0]?.id ?? null;
    }
  }

  await sql`
    update students set
      english_name = ${String(formData.get('english_name') ?? '').trim() || null},
      myanmar_name = ${String(formData.get('myanmar_name') ?? '').trim() || null},
      current_status = ${String(formData.get('status') ?? 'Active')},
      enrolled_at = ${String(formData.get('enrolled_at') ?? '') || null},
      notes = ${String(formData.get('notes') ?? '').trim() || null},
      guardian_id = ${guardianId},
      updated_at = now()
    where id = ${id}`;

  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}`);
}

export default async function EditStudent({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();
  const rows = await sql`
    select s.english_name, s.myanmar_name, s.current_status, s.notes,
           to_char(s.enrolled_at, 'YYYY-MM-DD') as enrolled_at,
           g.phone_primary, g.phone_secondary, g.viber_number
    from students s left join guardians g on g.id = s.guardian_id
    where s.id = ${id}`;
  const s = rows[0] as unknown as {
    english_name: string | null; myanmar_name: string | null; current_status: string;
    notes: string | null; enrolled_at: string | null;
    phone_primary: string | null; phone_secondary: string | null; viber_number: string | null;
  } | undefined;
  if (!s) notFound();
  const g = s;

  const action = saveStudent.bind(null, id);
  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title={`Edit student #${id}`} subtitle={s.english_name ?? s.myanmar_name ?? ''} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div><label className="label">English name</label>
            <input name="english_name" defaultValue={s.english_name ?? ''} className="input" /></div>
          <div><label className="label">Myanmar name</label>
            <input name="myanmar_name" defaultValue={s.myanmar_name ?? ''} className="input" /></div>
          <div><label className="label">Phone</label>
            <input name="phone" defaultValue={g?.phone_primary ?? ''} className="input" /></div>
          <div><label className="label">Phone 2</label>
            <input name="phone2" defaultValue={g?.phone_secondary ?? ''} className="input" /></div>
          <div><label className="label">Viber</label>
            <input name="viber" defaultValue={g?.viber_number ?? ''} className="input" /></div>
          <div><label className="label">Status</label>
            <select name="status" defaultValue={s.current_status} className="input">
              <option>Active</option><option>Break</option><option>Left</option><option>Prospect</option>
            </select></div>
          <div><label className="label">Enrolled at</label>
            <input name="enrolled_at" type="date" defaultValue={s.enrolled_at ?? ''} className="input" /></div>
          <div className="col-span-2"><label className="label">Notes</label>
            <textarea name="notes" defaultValue={s.notes ?? ''} className="input min-h-[60px]" /></div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <a href={`/students/${id}`} className="btn-ghost">Cancel</a>
          <SubmitButton>Save</SubmitButton>
        </div>
      </form>
    </div>
  );
}
