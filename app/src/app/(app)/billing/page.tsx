import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';
import { mmk, monthLabel } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import Pagination, { parsePage } from '@/components/pagination';
import { getLevels, getSections } from '@/lib/reference';
import SearchInput from '@/components/search-input';
import BulkInvoiceTable from '@/components/bulk-invoice-table';

async function generateInvoices(formData: FormData) {
  'use server';
  const monthStr = String(formData.get('month') ?? '');
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return;
  await requireRole(WRITE_FINANCE);
  const r = await sql`select generate_invoices_for_month(${`${monthStr}-01`}) as n`;
  revalidatePath('/billing');
  redirect(`/billing?month=${monthStr}&generated=${r[0]?.n ?? 0}`);
}

// Undo a Generate: delete the month's OPEN (unpaid) invoices (line items cascade).
async function deleteGeneratedInvoices(monthStr: string) {
  'use server';
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return;
  await requireRole(WRITE_FINANCE);
  const removed = await sql`delete from invoices where billing_month = ${`${monthStr}-01`} and status = 'open' returning id`;
  revalidatePath('/billing');
  redirect(`/billing?month=${monthStr}&deleted=${removed.length}`);
}

type InvRow = {
  id: number; billing_month: string | Date; total_amount: number; is_new_student: boolean | null; status: string;
  student_id: number; english_name: string | null; myanmar_name: string | null;
  time_slot: string; is_online: boolean; level_name: string | null; full_count: number;
};
type SecOpt = { id: number; time_slot: string; is_online: boolean; level_id: number; level: { name: string; display_order: number } | null };

export default async function BillingPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; generated?: string; deleted?: string; status?: string; q?: string; level?: string; section?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) ? sp.month : defaultMonth;
  const monthIso = `${month}-01`;
  const generated = sp.generated ? Number(sp.generated) : null;
  const deleted = sp.deleted ? Number(sp.deleted) : null;
  const status = sp.status ?? 'all';
  const q = (sp.q ?? '').trim();
  const level = sp.level ?? 'all';
  const section = sp.section ?? 'all';
  const { page, pageSize, from } = parsePage(sp, 50);
  const nextMonthIso = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString();

  const statusCond = status !== 'all' ? sql`and i.status = ${status}` : sql``;
  const sectionCond = section !== 'all' ? sql`and i.section_id = ${Number(section)}` : sql``;
  const levelCond = level !== 'all' ? sql`and sec.level_id = ${Number(level)}` : sql``;
  const searchCond = q ? sql`and (st.english_name ilike ${'%' + q + '%'} or st.myanmar_name ilike ${'%' + q + '%'})` : sql``;

  const [activeRows, monthInvoices, monthPayments, levels, sectionsList, invoices] = await Promise.all([
    sql`select count(*)::int n from students where current_status = 'Active'`,
    sql`select status, total_amount from invoices where billing_month = ${monthIso}`,
    sql`select amount from payments where paid_at >= ${monthIso} and paid_at < ${nextMonthIso}`,
    getLevels(),
    getSections(),
    sql`
      select i.id, i.billing_month, i.total_amount, i.is_new_student, i.status,
             st.id as student_id, st.english_name, st.myanmar_name,
             sec.time_slot, sec.is_online, l.name as level_name,
             count(*) over()::int as full_count
      from invoices i
      join students st on st.id = i.student_id
      join sections sec on sec.id = i.section_id
      join levels l on l.id = sec.level_id
      where i.billing_month = ${monthIso} ${statusCond} ${sectionCond} ${levelCond} ${searchCond}
      order by i.id desc
      limit ${pageSize} offset ${from}` as Promise<unknown> as Promise<InvRow[]>,
  ]);

  const count = (invoices as InvRow[])[0]?.full_count ?? 0;
  const sectionOptions = (sectionsList as unknown as SecOpt[])
    .filter((s) => level === 'all' || String(s.level_id) === level)
    .sort((a, b) => {
      const la = a.level?.display_order ?? 999, lb = b.level?.display_order ?? 999;
      return la === lb ? (a.time_slot ?? '').localeCompare(b.time_slot ?? '') : la - lb;
    });

  const mi = monthInvoices as unknown as { status: string; total_amount: number }[];
  const totalInvoiced = mi.filter((i) => i.status !== 'void').reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const openCount = mi.filter((i) => i.status === 'open').length;
  const paidCount = mi.filter((i) => i.status === 'paid').length;
  const collected = (monthPayments as unknown as { amount: number }[]).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div className="page">
      <PageHeader
        title="Billing"
        subtitle={`${monthLabel(monthIso)} · ${count.toLocaleString()} invoices`}
        actions={<a href={`/billing/export?${new URLSearchParams({ month, status, level, section, q }).toString()}`} className="btn-ghost">Export CSV</a>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <Stat label="Active students" value={(activeRows[0]?.n ?? 0).toLocaleString()} />
        <Stat label="Total invoiced" value={mmk(totalInvoiced)} />
        <Stat label="Open" value={openCount.toLocaleString()} tone={openCount > 0 ? 'bad' : 'default'} />
        <Stat label="Paid" value={paidCount.toLocaleString()} tone="good" />
        <Stat label="Collected" value={mmk(collected)} tone="good" />
      </div>

      <div className="card mb-4">
        <div className="font-semibold mb-2">Generate monthly invoices</div>
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex gap-2 items-center">
            <input name="month" type="month" defaultValue={month} className="input max-w-[180px]" />
            <button className="btn-ghost">View month</button>
          </form>
          <form action={generateInvoices}>
            <input type="hidden" name="month" value={month} />
            <button type="submit" className="btn-primary"
              title="Creates an invoice for every active student in an active enrolment. Re-running is safe — already-invoiced students are skipped.">
              Generate for {monthLabel(monthIso)}
            </button>
          </form>
          <DeleteButton
            action={deleteGeneratedInvoices.bind(null, month)}
            label="Undo generate"
            description={`Delete all OPEN (unpaid) invoices for ${monthLabel(monthIso)}. Paid and partial invoices are kept. You can re-run Generate to recreate them.`}
            className="btn-ghost text-rose-600"
          />
          {generated !== null && (
            <span className="text-xs text-emerald-700">✓ Generated {generated.toLocaleString()} invoice{generated === 1 ? '' : 's'}.</span>
          )}
          {deleted !== null && (
            <span className="text-xs text-rose-700">✓ Deleted {deleted.toLocaleString()} open invoice{deleted === 1 ? '' : 's'}.</span>
          )}
        </div>
      </div>

      <form className="flex gap-2 mb-3 flex-wrap">
        <input name="month" type="month" defaultValue={month} className="input max-w-[180px]" />
        <select name="level" defaultValue={level} className="input max-w-[170px]">
          <option value="all">All levels</option>
          {(levels as unknown as { id: number; name: string }[]).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select name="section" defaultValue={section} className="input max-w-[220px]">
          <option value="all">All classes</option>
          {sectionOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.level?.name ?? '?'} ({s.time_slot}){s.is_online ? ' · Online' : ''}</option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="input max-w-[140px]">
          <option value="all">All status</option>
          <option value="open">Open</option><option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
        <SearchInput defaultValue={q} placeholder="Search student name…" className="input max-w-xs" />
        <button className="btn-ghost">Filter</button>
        {(q || status !== 'all' || level !== 'all' || section !== 'all') && (
          <a href={`/billing?month=${month}`} className="btn-ghost">Clear</a>
        )}
      </form>

      <BulkInvoiceTable
        invoices={(invoices as InvRow[]).map((inv) => ({
          id: inv.id,
          billing_month: inv.billing_month,
          total_amount: Number(inv.total_amount),
          status: inv.status ?? 'open',
          is_new_student: inv.is_new_student,
          student: { id: inv.student_id, english: inv.english_name, myanmar: inv.myanmar_name },
          sectionLabel: `${inv.level_name ?? '?'} (${inv.time_slot})${inv.is_online ? ' Online' : ''}`,
        }))}
      />
      <Pagination page={page} pageSize={pageSize} total={count} basePath="/billing" query={{ month, status, level, section, q }} />

      <p className="mt-4 text-xs text-slate-500">
        Note: paid invoices show in <Link href="/payments" className="text-brand-600 hover:underline">/payments</Link>.
        Each student&apos;s invoices appear on their detail page.
      </p>
    </div>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'bad' }) {
  const cls = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 rounded-md px-3 py-2">
      <div className="text-[10px] uppercase text-slate-500 tracking-wide">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 leading-tight tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
