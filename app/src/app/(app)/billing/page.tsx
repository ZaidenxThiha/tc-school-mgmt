import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { mmk, monthLabel, shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';
import { getLevels, getSections } from '@/lib/reference';
import SearchInput from '@/components/search-input';
import PayInFullButton from '@/components/pay-in-full-button';
import { deleteInvoice } from '@/lib/actions/invoice';


async function generateInvoices(formData: FormData) {
  'use server';
  const monthStr = String(formData.get('month') ?? '');
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return;
  const targetMonth = `${monthStr}-01`;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('generate_invoices_for_month', { target_month: targetMonth });
  if (error) throw new Error(error.message);
  revalidatePath('/billing');
  redirect(`/billing?month=${monthStr}&generated=${data ?? 0}`);
}

async function voidInvoice(id: number, monthStr: string) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('invoices').update({ status: 'void' }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/billing');
  redirect(`/billing?month=${monthStr}`);
}

// Undo a Generate: delete the month's OPEN (unpaid) invoices. An open invoice
// can never have a payment (the reconciliation trigger would have made it
// partial/paid), so this only removes freshly-generated/unpaid ones — paid and
// partial invoices are left untouched. Line items cascade.
async function deleteGeneratedInvoices(monthStr: string) {
  'use server';
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return;
  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from('invoices')
    .delete()
    .eq('billing_month', `${monthStr}-01`)
    .eq('status', 'open')
    .select('id');
  if (error) throw new Error(error.message);
  revalidatePath('/billing');
  redirect(`/billing?month=${monthStr}&deleted=${removed?.length ?? 0}`);
}

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
  const status  = sp.status  ?? 'all';
  const q       = sp.q       ?? '';
  const level   = sp.level   ?? 'all';
  const section = sp.section ?? 'all';
  const { page, pageSize, from, to } = parsePage(sp, 50);

  const supabase = await createClient();

  // Build the paginated invoice query up front so it runs in the same batch as
  // the summary queries (one round-trip instead of two).
  let invQuery = supabase
    .from('invoices')
    .select(`
      id, billing_month, total_amount, discount, fine, status, is_new_student, created_at, section_id,
      student:students!inner(id, english_name, myanmar_name, current_status),
      section:sections!inner(id, time_slot, is_online, level_id, level:levels(name, code))
    `, { count: 'exact' })
    .eq('billing_month', monthIso)
    .order('id', { ascending: false });
  if (status  !== 'all') invQuery = invQuery.eq('status', status);
  if (section !== 'all') invQuery = invQuery.eq('section_id', Number(section));
  if (level   !== 'all') invQuery = invQuery.eq('sections.level_id', Number(level));
  if (q) invQuery = invQuery.or(`english_name.ilike.%${q}%,myanmar_name.ilike.%${q}%`, { foreignTable: 'students' });

  const [
    { count: activeStudents },
    { data: monthInvoices },
    { data: monthPayments },
    levels,
    sectionsList,
    { data: invoices, count },
  ] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('current_status', 'Active'),
    supabase.from('invoices').select('id, status, total_amount').eq('billing_month', monthIso),
    supabase.from('payments').select('amount').gte('paid_at', monthIso)
      .lt('paid_at', new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5,7)), 1)).toISOString()),
    getLevels(),
    getSections(),
    invQuery.range(from, to),
  ]);

  // Filter sections list by selected level for the dropdown
  const sectionOptions = (sectionsList ?? [])
    .filter((s) => level === 'all' || String(s.level_id) === level)
    .sort((a, b) => {
      const la = (a.level as unknown as { display_order?: number } | null)?.display_order ?? 999;
      const lb = (b.level as unknown as { display_order?: number } | null)?.display_order ?? 999;
      return la === lb ? (a.time_slot ?? '').localeCompare(b.time_slot ?? '') : la - lb;
    });

  const totalInvoiced = (monthInvoices ?? []).filter((i) => i.status !== 'void').reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const openCount = (monthInvoices ?? []).filter((i) => i.status === 'open').length;
  const paidCount = (monthInvoices ?? []).filter((i) => i.status === 'paid').length;
  const voidCount = (monthInvoices ?? []).filter((i) => i.status === 'void').length;
  const collected = (monthPayments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div className="page">
      <PageHeader
        title="Billing"
        subtitle={`${monthLabel(monthIso)} · ${(count ?? 0).toLocaleString()} invoices`}
        actions={
          <a href={`/billing/export?${new URLSearchParams({ month, status, level, section, q }).toString()}`} className="btn-ghost">Export CSV</a>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <Stat label="Active students" value={(activeStudents ?? 0).toLocaleString()} />
        <Stat label="Total invoiced" value={mmk(totalInvoiced)} tone="default" />
        <Stat label="Open" value={openCount.toLocaleString()} tone={openCount > 0 ? 'bad' : 'default'} />
        <Stat label="Paid" value={paidCount.toLocaleString()} tone="good" />
        <Stat label="Collected" value={mmk(collected)} tone="good" />
      </div>

      <div className="card mb-4">
        <div className="font-semibold mb-2">Generate monthly invoices</div>
        <p className="text-xs text-slate-500 mb-3">
          Creates an invoice for every active student in an active enrolment. Re-running is safe — students who already have an invoice for the month are skipped.
        </p>
        <form action={generateInvoices} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Month</label>
            <input name="month" type="month" required defaultValue={month} className="input max-w-[180px]" />
          </div>
          <button type="submit" className="btn-primary">Generate</button>
          {generated !== null && (
            <span className={`text-xs ${generated > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
              ✓ Generated {generated.toLocaleString()} new invoice{generated === 1 ? '' : 's'} for {monthLabel(monthIso)}.
            </span>
          )}
        </form>
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <DeleteButton
            action={deleteGeneratedInvoices.bind(null, month)}
            label="Undo generate"
            description={`Delete all OPEN (unpaid) invoices for ${monthLabel(monthIso)}. Paid and partial invoices are kept. You can re-run Generate to recreate them.`}
          />
          <span className="text-xs text-slate-400">Removes this month&apos;s unpaid invoices if you generated by mistake.</span>
          {deleted !== null && (
            <span className="text-xs text-rose-700">✓ Deleted {deleted.toLocaleString()} open invoice{deleted === 1 ? '' : 's'} for {monthLabel(monthIso)}.</span>
          )}
        </div>
      </div>

      <form className="flex gap-2 mb-3 flex-wrap">
        <input name="month" type="month" defaultValue={month} className="input max-w-[180px]" />
        <select name="level" defaultValue={level} className="input max-w-[170px]">
          <option value="all">All levels</option>
          {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select name="section" defaultValue={section} className="input max-w-[220px]">
          <option value="all">All classes</option>
          {sectionOptions.map((s) => {
            const l = s.level as unknown as { name: string } | null;
            return (
              <option key={s.id} value={s.id}>
                {l?.name ?? '?'} ({s.time_slot}){s.is_online ? ' · Online' : ''}
              </option>
            );
          })}
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

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>#</th><th>Student</th><th>Section</th><th>Type</th>
              <th className="text-right">Amount</th><th>Status</th>
              <th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {(invoices ?? []).map((inv) => {
                const s = inv.student as unknown as { id: number; english_name: string | null; myanmar_name: string | null } | null;
                const sec = inv.section as unknown as { time_slot: string; is_online: boolean; level: { name: string } | null } | null;
                const sectionLabel = sec ? `${sec.level?.name ?? '?'} (${sec.time_slot})${sec.is_online ? ' Online' : ''}` : '—';
                const badge =
                  inv.status === 'paid'    ? 'badge-green' :
                  inv.status === 'partial' ? 'badge-amber' :
                  inv.status === 'void'    ? 'badge-slate' :
                  'badge-rose';
                const voidAct = voidInvoice.bind(null, inv.id, month);
                return (
                  <tr key={inv.id}>
                    <td className="text-slate-400">{inv.id}</td>
                    <td>
                      {s ? (
                        <Link href={`/students/${s.id}`} className="text-brand-600 hover:underline">
                          {s.english_name ?? '—'}
                          {s.myanmar_name && (
                            <div className="text-[11px] text-slate-500 font-normal">{s.myanmar_name}</div>
                          )}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="text-xs">{sectionLabel}</td>
                    <td><span className={inv.is_new_student ? 'badge-amber' : 'badge-slate'}>{inv.is_new_student ? 'New' : 'Old'}</span></td>
                    <td className="text-right tabular-nums">{mmk(inv.total_amount)}</td>
                    <td><span className={badge}>{inv.status}</span></td>
                    <td className="text-right whitespace-nowrap">
                      {inv.status === 'open' && (
                        <PayInFullButton invoiceId={inv.id} amountLabel={mmk(inv.total_amount)} />
                      )}
                      <Link href={`/billing/${inv.id}/receipt`} className="text-slate-600 hover:underline text-xs ml-3">Receipt</Link>
                      <Link href={`/billing/${inv.id}/edit`} className="text-brand-600 hover:underline text-xs ml-3">Edit</Link>
                      {inv.status !== 'void' && inv.status !== 'paid' && (
                        <form action={voidAct} className="inline ml-3">
                          <button type="submit" className="text-slate-500 hover:text-slate-700 text-xs">Void</button>
                        </form>
                      )}
                      <span className="ml-3 inline-block align-middle">
                        <DeleteButton
                          action={deleteInvoice.bind(null, inv.id, s?.id ?? 0)}
                          label="Delete"
                          description="Delete this invoice, its line items, and any linked payments. Cannot be undone."
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(invoices?.length ?? 0) === 0 && (
                <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No invoices for {monthLabel(monthIso)}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/billing" query={{ month, status, level, section, q }} />
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Note: paid invoices show in <Link href="/payments" className="text-brand-600 hover:underline">/payments</Link>.
        Each student's invoices appear on their detail page (<code>/students/[id]</code>).
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
