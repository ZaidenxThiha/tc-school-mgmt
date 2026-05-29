import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import AutoSubmitSelect from '@/components/auto-submit-select';
import { mmk, monthLabel } from '@/lib/format';

// Maps a fee_schedule column to the invoice_lines.kind used historically.
const LINE_ITEMS = [
  { key: 'class_fee', col: 'class_fee' as const,   kind: 'class_fee', label: 'Class fee',  oneTime: false },
  { key: 'book',      col: 'textbook_fee' as const, kind: 'book',     label: 'Textbook',   oneTime: true },
  { key: 'tshirt',    col: 'tshirt_fee' as const,   kind: 'tshirt',   label: 'T-shirt',    oneTime: true },
  { key: 'id',        col: 'id_card_fee' as const,  kind: 'id',       label: 'ID card',    oneTime: true },
  { key: 'guide',     col: 'guide_fee' as const,    kind: 'guide',    label: 'Guide book', oneTime: true },
];

type FeeRow = Record<string, number | null>;

async function feeRowFor(supabase: Awaited<ReturnType<typeof createClient>>, levelId: number, monthIso: string): Promise<FeeRow | null> {
  const { data } = await supabase
    .from('fee_schedule')
    .select('class_fee, textbook_fee, tshirt_fee, id_card_fee, guide_fee, default_discount')
    .eq('level_id', levelId)
    .lte('effective_from', monthIso)
    .or(`effective_to.is.null,effective_to.gte.${monthIso}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as FeeRow) ?? null;
}

async function createInvoice(formData: FormData) {
  'use server';
  const supabase = await createClient();

  const studentId = Number(formData.get('student_id'));
  const sectionId = Number(formData.get('section_id'));
  const monthStr = String(formData.get('billing_month') ?? '');
  const isNew = formData.get('is_new_student') === '1';
  const discount = Math.max(0, Number(formData.get('discount') ?? 0) || 0);

  if (!Number.isFinite(studentId) || !Number.isFinite(sectionId)) throw new Error('Student and section are required');
  if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new Error('Invalid billing month');
  const monthIso = `${monthStr}-01`;

  // Resolve the section's level, then the fee schedule for that month.
  const { data: section } = await supabase.from('sections').select('level_id').eq('id', sectionId).single();
  if (!section) throw new Error('Section not found');
  const fees = await feeRowFor(supabase, section.level_id as number, monthIso);
  if (!fees) redirect(`/billing/new?student=${studentId}&section=${sectionId}&error=nofees`);

  // Block exact duplicates (same student + month + section, not voided).
  const { data: dup } = await supabase
    .from('invoices').select('id')
    .eq('student_id', studentId).eq('section_id', sectionId).eq('billing_month', monthIso)
    .neq('status', 'void').maybeSingle();
  if (dup) redirect(`/billing/new?student=${studentId}&section=${sectionId}&error=duplicate`);

  // Build line items server-side from the fee schedule (never trust the client).
  const lines = LINE_ITEMS
    .filter((li) => formData.get(`line_${li.key}`) === '1')
    .map((li) => ({ kind: li.kind, label: li.label, amount: Number(fees![li.col] ?? 0) }))
    .filter((l) => l.amount > 0);

  if (lines.length === 0) redirect(`/billing/new?student=${studentId}&section=${sectionId}&error=nolines`);

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const total = Math.max(0, subtotal - discount);

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      student_id: studentId,
      section_id: sectionId,
      billing_month: monthIso,
      is_new_student: isNew,
      discount: discount || null,
      total_amount: total,
      status: 'open',
    })
    .select('id').single();
  if (invErr) throw new Error(invErr.message);

  const { error: lineErr } = await supabase.from('invoice_lines').insert(
    lines.map((l) => ({ invoice_id: invoice!.id, kind: l.kind, description: l.label, qty: 1, unit_price: l.amount, amount: l.amount })),
  );
  if (lineErr) throw new Error(lineErr.message);

  revalidatePath('/billing');
  revalidatePath(`/students/${studentId}`);
  redirect(`/billing/${invoice!.id}/edit`);
}

const ERRORS: Record<string, string> = {
  nofees: 'No fee schedule found for this level/month. Add one under Settings → Fees first.',
  duplicate: 'A non-void invoice already exists for this student, section, and month.',
  nolines: 'Select at least one line item to bill.',
};

export default async function NewInvoicePage({
  searchParams,
}: { searchParams: Promise<{ student?: string; section?: string; error?: string }> }) {
  const sp = await searchParams;
  const studentId = sp.student ? Number(sp.student) : null;
  if (!studentId) {
    // Need a student to build an invoice — send them to pick one.
    redirect('/students');
  }
  const errorMsg = sp.error ? ERRORS[sp.error] ?? 'Could not create invoice.' : null;

  const supabase = await createClient();
  const [{ data: student }, { data: enrolments }] = await Promise.all([
    supabase.from('students').select('id, english_name, myanmar_name').eq('id', studentId).single(),
    supabase.from('enrolments')
      .select('id, section_id, section:sections(id, time_slot, is_online, level_id, level:levels(name, display_order))')
      .eq('student_id', studentId).is('end_date', null),
  ]);
  if (!student) notFound();

  const sectionOptions = (enrolments ?? [])
    .map((e) => e.section as unknown as { id: number; time_slot: string; is_online: boolean; level_id: number; level: { name: string; display_order: number } | null })
    .filter(Boolean)
    .sort((a, b) => (a.level?.display_order ?? 999) - (b.level?.display_order ?? 999));

  const effectiveSectionId = sp.section ? Number(sp.section) : sectionOptions[0]?.id ?? null;
  const effectiveSection = sectionOptions.find((s) => s.id === effectiveSectionId) ?? null;

  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthIso = `${defaultMonth}-01`;

  const fees = effectiveSection ? await feeRowFor(supabase, effectiveSection.level_id, monthIso) : null;
  const studentName = student.english_name ?? student.myanmar_name ?? `#${student.id}`;

  return (
    <div className="page-narrow max-w-2xl">
      <PageHeader title="Create invoice" subtitle={`${studentName} · build an itemized invoice`} />

      {errorMsg && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMsg}</div>
      )}

      {sectionOptions.length === 0 ? (
        <div className="card text-sm text-slate-600">
          This student has no active enrolment. <a href={`/enrolments/new?student=${student.id}`} className="text-brand-600 hover:underline">Enroll them first</a>.
        </div>
      ) : (
        <>
          {/* Section selector (reloads fee preview) */}
          <form className="card mb-4 space-y-2">
            <label className="label">Section</label>
            <AutoSubmitSelect
              name="section" param="section" value={String(effectiveSectionId ?? '')}
              basePath="/billing/new" carry={{ student: String(student.id) }} className="input"
            >
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.level?.name ?? '?'} ({s.time_slot}{s.is_online ? ' · Online' : ''})</option>
              ))}
            </AutoSubmitSelect>
          </form>

          <form action={createInvoice} className="card space-y-4">
            <input type="hidden" name="student_id" value={student.id} />
            <input type="hidden" name="section_id" value={effectiveSectionId ?? ''} />

            <div className="form-grid-2">
              <div>
                <label className="label">Billing month</label>
                <input name="billing_month" type="month" required defaultValue={defaultMonth} className="input" />
              </div>
              <div>
                <label className="label">Discount (MMK)</label>
                <input name="discount" type="number" min="0" defaultValue={Number(fees?.default_discount ?? 0) || 0} className="input" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_new_student" value="1" /> New student (charge one-time enrolment fees)
            </label>

            <div>
              <div className="label mb-1">Line items</div>
              <div className="rounded-md border border-slate-200 divide-y">
                {LINE_ITEMS.map((li) => {
                  const amount = Number(fees?.[li.col] ?? 0);
                  const disabled = !(amount > 0);
                  return (
                    <label key={li.key} className={`flex items-center justify-between px-3 py-2 text-sm ${disabled ? 'opacity-40' : ''}`}>
                      <span className="flex items-center gap-2">
                        <input type="checkbox" name={`line_${li.key}`} value="1" defaultChecked={!li.oneTime && !disabled} disabled={disabled} />
                        {li.label} {li.oneTime && <span className="text-[10px] text-slate-400">one-time</span>}
                      </span>
                      <span className="tabular-nums text-slate-600">{amount > 0 ? mmk(amount) : '—'}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Amounts come from the fee schedule for {monthLabel(monthIso)}. The total is recomputed on save.</p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <a href={`/students/${student.id}`} className="btn-ghost">Cancel</a>
              <button type="submit" className="btn-primary">Create invoice</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
