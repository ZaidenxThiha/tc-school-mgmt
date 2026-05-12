import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { mmk, shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';


export default async function PaymentsPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; channel?: string; q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const month   = sp.month ?? '';
  const channel = sp.channel ?? 'all';
  const q       = sp.q ?? '';
  const { page, pageSize, from, to } = parsePage(sp, 50);

  const supabase = await createClient();
  let query = supabase
    .from('payments')
    .select('id, paid_at, amount, channel, note, student:students!inner(id, english_name, myanmar_name)', { count: 'exact' })
    .order('paid_at', { ascending: false });

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end   = new Date(Date.UTC(y, m, 1)).toISOString();
    query = query.gte('paid_at', start).lt('paid_at', end);
  }
  if (channel !== 'all') query = query.eq('channel', channel);
  if (q) {
    // search by student name OR note
    query = query.or(`english_name.ilike.%${q}%,myanmar_name.ilike.%${q}%`, { foreignTable: 'students' });
  }

  const { data: payments, count, error } = await query.range(from, to);

  return (
    <div className="page">
      <PageHeader
        title="Payments"
        subtitle={`${(count ?? 0).toLocaleString('en-US')} matching`}
        actions={<Link href="/payments/new" className="btn-primary">+ Add payment</Link>}
      />

      <form className="flex gap-2 mb-4 flex-wrap">
        <input name="q" defaultValue={q} placeholder="Search student name…" className="input max-w-sm" />
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
        {error && <div className="p-4 text-rose-700 text-sm">{error.message}</div>}
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>#</th><th>Date</th><th>Student</th><th className="text-right">Amount</th><th>Channel</th><th>Note</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {(payments ?? []).map((p) => {
                const s = p.student as unknown as { id: number; english_name: string | null; myanmar_name: string | null } | null;
                const del = deleteRow.bind(null, 'payments', p.id, '/payments');
                return (
                  <tr key={p.id}>
                    <td className="text-slate-400">{p.id}</td>
                    <td>{shortDate(p.paid_at)}</td>
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
              {(payments?.length ?? 0) === 0 && !error && (
                <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No payments in this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/payments" query={{ q, month, channel }} />
      </div>
    </div>
  );
}
