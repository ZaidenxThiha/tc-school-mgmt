import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';
import AutoSubmitSelect from '@/components/auto-submit-select';
import { mmk, monthLabel } from '@/lib/format';
import SubmitButton from '@/components/submit-button';

// Maps a fee_schedule column to the invoice_lines.kind used historically.
const LINE_ITEMS = [
  { key: 'class_fee', col: 'class_fee' as const,   kind: 'class_fee', label: 'Class fee',  oneTime: false },
  { key: 'book',      col: 'textbook_fee' as const, kind: 'book',     label: 'Textbook',   oneTime: true },
  { key: 'tshirt',    col: 'tshirt_fee' as const,   kind: 'tshirt',   label: 'T-shirt',    oneTime: true },
  { key: 'id',        col: 'id_card_fee' as const,  kind: 'id',       label: 'ID card',    oneTime: true },
  { key: 'guide',     col: 'guide_fee' as const,    kind: 'guide',    label: 'Guide book', oneTime: true },
];

type FeeRow = Record<string, number | string | null>;

async function feeRowFor(levelId: number, monthIso: string): Promise<FeeRow | null> {
  const rows = await sql`
    select class_fee, textbook_fee, tshirt_fee, id_card_fee, guide_fee, default_discount
    from fee_schedule
    where level_id = ${levelId} and effective_from <= ${monthIso}
      and (effective_to is null or effective_to >= ${monthIso})
    order by effective_from desc limit 1`;
  return (rows[0] as FeeRow) ?? null;
}

async function createInvoice(formData: FormData) {
  'use server';
  await requireRole(WRITE_FINANCE);

  const studentId = Number(formData.get('student_id'));
  const sectionId = Number(formData.get('section_id'));
  const monthStr = String(formData.get('billing_month') ?? '');
  const isNew = formData.get('is_new_student') === '1';
  const discount = Math.max(0, Number(formData.get('discount') ?? 0) || 0);

  if (!Number.isFinite(studentId) || !Number.isFinite(sectionId)) throw new Error('Student and section are required');
  if (!/^\d{4}-\d{2}$/.test(monthStr)) throw new Error('Invalid billing month');
  const monthIso = `${monthStr}-01`;

  const section = await sql`select level_id from sections where id = ${sectionId}`;
  if (!section[0]) throw new Error('Section not found');
  const fees = await feeRowFor(section[0].level_id as number, monthIso);
  if (!fees) redirect(`/billing/new?student=${studentId}&section=${sectionId}&error=nofees`);

  const dup = await sql`
    select id from invoices
    where student_id = ${studentId} and section_id = ${sectionId} and billing_month = ${monthIso} and status <> 'void'
    limit 1`;
  if (dup[0]) redirect(`/billing/new?student=${studentId}&section=${sectionId}&error=duplicate`);

  const lines = LINE_ITEMS
    .filter((li) => formData.get(`line_${li.key}`) === '1')
    .map((li) => ({ kind: li.kind, label: li.label, amount: Number(fees![li.col] ?? 0) }))
    .filter((l) => l.amount > 0);
  if (lines.length === 0) redirect(`/billing/new?student=${studentId}&section=${sectionId}&error=nolines`);

  const total = Math.max(0, lines.reduce((s, l) => s + l.amount, 0) - discount);

  const inv = await sql`
    insert into invoices (student_id, section_id, billing_month, is_new_student, discount, total_amount, status)
    values (${studentId}, ${sectionId}, ${monthIso}, ${isNew}, ${discount || null}, ${total}, 'open')
    returning id`;
  const invoiceId = inv[0].id;

  await sql`insert into invoice_lines ${sql(lines.map((l) => ({ invoice_id: invoiceId, kind: l.kind, description: l.label, qty: 1, unit_price: l.amount, amount: l.amount })))}`;

  revalidatePath('/billing');
  revalidatePath(`/students/${studentId}`);
  redirect(`/billing/${invoiceId}/edit`);
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

  const [studentRows, enrolments] = await Promise.all([
    sql`select id, english_name, myanmar_name from students where id = ${studentId}`,
    sql`select e.id, e.section_id,
          json_build_object('id', sec.id, 'time_slot', sec.time_slot, 'is_online', sec.is_online,
            'level_id', sec.level_id, 'level', json_build_object('name', l.name, 'display_order', l.display_order)) as section
        from enrolments e join sections sec on sec.id = e.section_id join levels l on l.id = sec.level_id
        where e.student_id = ${studentId} and e.end_date is null`,
  ]);
  const student = studentRows[0] as unknown as { id: number; english_name: string | null; myanmar_name: string | null } | undefined;
  if (!student) notFound();

  type Sec = { id: number; time_slot: string; is_online: boolean; level_id: number; level: { name: string; display_order: number } | null };
  const sectionOptions = (enrolments as unknown as { section: Sec }[])
    .map((e) => e.section)
    .filter(Boolean)
    .sort((a, b) => (a.level?.display_order ?? 999) - (b.level?.display_order ?? 999));

  const effectiveSectionId = sp.section ? Number(sp.section) : sectionOptions[0]?.id ?? null;
  const effectiveSection = sectionOptions.find((s) => s.id === effectiveSectionId) ?? null;

  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthIso = `${defaultMonth}-01`;

  const fees = effectiveSection ? await feeRowFor(effectiveSection.level_id, monthIso) : null;
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
              <SubmitButton pendingLabel="Creating…">Create invoice</SubmitButton>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
