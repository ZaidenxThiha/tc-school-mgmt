import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import { mmk, shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';
import SearchInput from '@/components/search-input';

type Row = {
  id: number; paid_at: string | Date; amount: number; channel: string; note: string | null;
  student_id: number; english_name: string | null; myanmar_name: string | null; full_count: number;
};

export default async function PaymentsPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; channel?: string; q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const month   = sp.month ?? '';
  const channel = sp.channel ?? 'all';
  const q       = (sp.q ?? '').trim();
  const { page, pageSize, from } = parsePage(sp, 50);

  let monthCond = sql``;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end   = new Date(Date.UTC(y, m, 1)).toISOString();
    monthCond = sql`and p.paid_at >= ${start} and p.paid_at < ${end}`;
  }
  const channelCond = channel !== 'all' ? sql`and p.channel = ${channel}` : sql``;
  const searchCond = q ? sql`and (st.english_name ilike ${'%' + q + '%'} or st.myanmar_name ilike ${'%' + q + '%'})` : sql``;

  const payments = (await sql`
    select p.id, p.paid_at, p.amount, p.channel, p.note,
           st.id as student_id, st.english_name, st.myanmar_name,
           count(*) over()::int as full_count
    from payments p join students st on st.id = p.student_id
    where true ${monthCond} ${channelCond} ${searchCond}
    order by p.paid_at desc
    limit ${pageSize} offset ${from}
  `) as unknown as Row[];
  const count = payments[0]?.full_count ?? 0;

  return (
    <div className="page">
      <PageHeader
        title="Payments"
        subtitle={`${count.toLocaleString('en-US')} matching`}
        actions={
          <>
            <a href={`/payments/export?${new URLSearchParams({ q, month, channel }).toString()}`} className="btn-ghost">Export CSV</a>
            <Link href="/payments/new" className="btn-primary">+ Add payment</Link>
          </>
        }
      />

      <form className="flex gap-2 mb-4 flex-wrap">
        <SearchInput defaultValue={q} placeholder="Search student name…" className="input max-w-sm" />
        <input name="month" type="month" defaultValue={month} className="input max-w-[180px]" />
        <select name="channel" defaultValue={channel} className="input max-w-[150px]">
          <option value="all">All channels</option>
          <option value="cash">Cash</option><option value="kpay">KPay</option>
          <option value="wave">Wave</option><option value="bank">Bank</option><option value="other">Other</option>
        </select>
        <button className="btn-ghost">Filter</button>
        {(q || month || channel !== 'all') && <a href="/payments" className="btn-ghost">Clear</a>}
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>#</th><th>Date</th><th>Student</th><th className="text-right">Amount</th><th>Channel</th><th>Note</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {payments.map((p) => {
                const del = deleteRow.bind(null, 'payments', p.id, '/payments');
                return (
                  <tr key={p.id}>
                    <td className="text-slate-400">{p.id}</td>
                    <td>{shortDate(p.paid_at)}</td>
                    <td>
                      <Link href={`/students/${p.student_id}`} className="text-brand-600 hover:underline">
                        {p.english_name ?? '—'}
                        {p.myanmar_name && <div className="text-[11px] text-slate-500 font-normal">{p.myanmar_name}</div>}
                      </Link>
                    </td>
                    <td className="tabular-nums">{mmk(p.amount)}</td>
                    <td><span className={p.channel === 'cash' ? 'badge-slate' : 'badge-green'}>{p.channel}</span></td>
                    <td className="text-xs text-slate-500 max-w-[180px] truncate" title={p.note ?? ''}>{p.note ?? '—'}</td>
                    <td className="text-right">
                      <Link href={`/payments/${p.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <DeleteButton action={del} />
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No payments in this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count} basePath="/payments" query={{ q, month, channel }} />
      </div>
    </div>
  );
}
