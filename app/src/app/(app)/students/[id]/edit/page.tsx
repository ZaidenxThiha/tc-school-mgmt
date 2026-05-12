import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { revalidatePath } from 'next/cache';


async function saveStudent(id: number, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const phone2 = String(formData.get('phone2') ?? '').trim() || null;
  const viber = String(formData.get('viber') ?? '').trim() || null;

  // Update or insert guardian
  const { data: stu } = await supabase.from('students').select('guardian_id').eq('id', id).single();
  let guardianId = stu?.guardian_id ?? null;
  if (phone || phone2 || viber) {
    if (guardianId) {
      await supabase.from('guardians').update({
        phone_primary: phone, phone_secondary: phone2, viber_number: viber,
      }).eq('id', guardianId);
    } else {
      const { data: g } = await supabase.from('guardians').insert({
        phone_primary: phone, phone_secondary: phone2, viber_number: viber,
      }).select('id').single();
      guardianId = g?.id ?? null;
    }
  }

  const { error } = await supabase.from('students').update({
    english_name: String(formData.get('english_name') ?? '').trim() || null,
    myanmar_name: String(formData.get('myanmar_name') ?? '').trim() || null,
    current_status: String(formData.get('status') ?? 'Active'),
    enrolled_at: String(formData.get('enrolled_at') ?? '') || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    guardian_id: guardianId,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}`);
}

export default async function EditStudent({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from('students').select('*, guardian:guardians(*)').eq('id', id).single();
  if (!s) notFound();
  const g = s.guardian as unknown as { phone_primary?: string; phone_secondary?: string; viber_number?: string } | null;

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
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
