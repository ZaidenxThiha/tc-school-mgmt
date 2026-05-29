import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { createEnrolment } from '@/lib/actions/enrolment';
import { getSections } from '@/lib/reference';

const ERRORS: Record<string, string> = {
  duplicate: 'That student already has an open enrolment in this section.',
  full: 'That section is at capacity. Increase its capacity or pick another section.',
};

export default async function NewEnrolmentPage({
  searchParams,
}: { searchParams: Promise<{ section?: string; student?: string; error?: string }> }) {
  const sp = await searchParams;
  const presetSection = sp.section ?? '';
  const presetStudent = sp.student ?? '';
  const errorMsg = sp.error ? ERRORS[sp.error] ?? 'Could not enroll student.' : null;

  const supabase = await createClient();
  const [{ data: students }, sections, { data: counts }] = await Promise.all([
    supabase.from('students').select('id, english_name, myanmar_name').order('english_name'),
    getSections(),
    supabase.from('v_section_active_count').select('section_id, active_count'),
  ]);

  const countMap = new Map<number, number>((counts ?? []).map((r) => [r.section_id as number, Number(r.active_count ?? 0)]));
  const sortedSections = (sections ?? []).slice().sort((a, b) => {
    const la = (a.level as unknown as { display_order?: number } | null)?.display_order ?? 999;
    const lb = (b.level as unknown as { display_order?: number } | null)?.display_order ?? 999;
    return la === lb ? (a.time_slot ?? '').localeCompare(b.time_slot ?? '') : la - lb;
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title="Enroll student" subtitle="Add a student to a section" />

      {errorMsg && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      <form action={createEnrolment} className="card space-y-4">
        <div className="form-grid-2">
          <div className="col-span-2">
            <label className="label">Student</label>
            <select name="student_id" required defaultValue={presetStudent} className="input">
              <option value="" disabled>Select a student…</option>
              {(students ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.english_name ?? s.myanmar_name ?? `Student #${s.id}`}
                  {s.english_name && s.myanmar_name ? ` — ${s.myanmar_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="label">Section</label>
            <select name="section_id" required defaultValue={presetSection} className="input">
              <option value="" disabled>Select a section…</option>
              {sortedSections.map((s) => {
                const level = s.level as unknown as { name: string } | null;
                const active = countMap.get(s.id) ?? 0;
                const cap = s.capacity ?? null;
                const fill = cap ? ` — ${active}/${cap}${active >= cap ? ' FULL' : ''}` : ` — ${active} enrolled`;
                return (
                  <option key={s.id} value={s.id}>
                    {level?.name ?? '?'} ({s.time_slot}{s.is_online ? ' · Online' : ''}){fill}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="label">Start date</label>
            <input name="start_date" type="date" required defaultValue={today} className="input" />
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue="Active" className="input">
              <option>Active</option>
              <option>Break</option>
              <option>Left</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <a href="/enrolments" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Enroll</button>
        </div>
      </form>
    </div>
  );
}
