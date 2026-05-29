import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { saveEnrolment } from '@/lib/actions/enrolment';

export default async function EditEnrolmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const { data: e } = await supabase
    .from('enrolments')
    .select(`
      id, start_date, end_date, status,
      student:students(english_name, myanmar_name),
      section:sections(time_slot, is_online, level:levels(name))
    `)
    .eq('id', id)
    .single();
  if (!e) notFound();

  const st = e.student as unknown as { english_name: string | null; myanmar_name: string | null } | null;
  const sec = e.section as unknown as { time_slot: string; is_online: boolean; level: { name: string } | null } | null;
  const studentName = st?.english_name ?? st?.myanmar_name ?? '—';
  const sectionLabel = sec ? `${sec.level?.name ?? '?'} (${sec.time_slot}${sec.is_online ? ' · Online' : ''})` : '—';

  const action = saveEnrolment.bind(null, id);

  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title={`Edit enrolment #${id}`} subtitle={`${studentName} · ${sectionLabel}`} />
      <form action={action} className="card space-y-4">
        <div className="form-grid-2">
          <div>
            <label className="label">Start date</label>
            <input name="start_date" type="date" required defaultValue={e.start_date ?? ''} className="input" />
          </div>
          <div>
            <label className="label">End date</label>
            <input name="end_date" type="date" defaultValue={e.end_date ?? ''} className="input" />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue={e.status} className="input">
              <option>Active</option>
              <option>Break</option>
              <option>Left</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500">Setting status to <strong>Left</strong> without an end date fills today automatically.</p>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/enrolments" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
