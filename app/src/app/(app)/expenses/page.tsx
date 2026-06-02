import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import { mmk, shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import Pagination, { parsePage } from '@/components/pagination';


export default async function ExpensesPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; account?: string; q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const month   = sp.month ?? '';
  const account = sp.account ?? 'all';
  const q       = sp.q ?? '';
  const { page, pageSize, from, to } = parsePage(sp, 50);

  const accounts = (await sql`
    select id, group_name, category from chart_of_accounts order by category, group_name
  `) as unknown as { id: number; group_name: string; category: string }[];

  // Compute Opening & Closing balances when a month is selected
  let openingBalance = 0;
  let monthIncome = 0;
  let monthExpense = 0;
  let monthValid = false;
  let monthStartIso = '';
  let monthEndIso = '';
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    monthValid = true;
    const [y, m] = month.split('-').map(Number);
    monthStartIso = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
    monthEndIso   = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    // Opening = sum of (income - expense) for ALL rows BEFORE this month
    const prior = await sql`select coalesce(sum(income_cash + income_kpay - expense_cash - expense_kpay), 0)::bigint as bal
      from ledger_entries where entry_date < ${monthStartIso}`;
    openingBalance = Number(prior[0]?.bal ?? 0);
    // Month income/expense from the actual full month (regardless of filter)
    const mrow = await sql`select coalesce(sum(income_cash + income_kpay), 0)::bigint as inc,
      coalesce(sum(expense_cash + expense_kpay), 0)::bigint as exp
      from ledger_entries where entry_date >= ${monthStartIso} and entry_date < ${monthEndIso}`;
    monthIncome  = Number(mrow[0]?.inc ?? 0);
    monthExpense = Number(mrow[0]?.exp ?? 0);
  }
  const closingBalance = openingBalance + monthIncome - monthExpense;

  const monthCond  = monthValid ? sql`and e.entry_date >= ${monthStartIso} and e.entry_date < ${monthEndIso}` : sql``;
  const acctCond   = account !== 'all' ? sql`and e.account_id = ${Number(account)}` : sql``;
  const searchCond = q ? sql`and e.description ilike ${'%' + q + '%'}` : sql``;

  const rows = (await sql`
    select e.id, to_char(e.entry_date, 'YYYY-MM-DD') as entry_date, e.description, e.source,
           e.income_cash, e.income_kpay, e.expense_cash, e.expense_kpay, e.qty, e.product_id,
           json_build_object('group_name', coa.group_name, 'category', coa.category) as account,
           case when p.id is null then null else json_build_object('id', p.id, 'name', p.name, 'kind', p.kind) end as product,
           count(*) over()::int as full_count
    from ledger_entries e
    left join chart_of_accounts coa on coa.id = e.account_id
    left join products p on p.id = e.product_id
    where true ${monthCond} ${acctCond} ${searchCond}
    order by e.entry_date desc, e.id desc
    limit ${pageSize} offset ${from}
  `) as unknown as Array<{
    id: number; entry_date: string; description: string | null; source: string | null;
    income_cash: number; income_kpay: number; expense_cash: number; expense_kpay: number;
    qty: number | null; product_id: number | null;
    account: { group_name: string; category: string } | null;
    product: { id: number; name: string; kind: string } | null;
    full_count: number;
  }>;
  const entries = rows;
  const count = rows[0]?.full_count ?? 0;
  const totIncome  = (entries ?? []).reduce((s, e) => s + Number(e.income_cash ?? 0) + Number(e.income_kpay ?? 0), 0);
  const totExpense = (entries ?? []).reduce((s, e) => s + Number(e.expense_cash ?? 0) + Number(e.expense_kpay ?? 0), 0);

  return (
    <div className="page">
      <PageHeader
        title="Expenses & ledger"
        subtitle={`${(count ?? 0).toLocaleString('en-US')} matching · page total: income ${mmk(totIncome)} · expense ${mmk(totExpense)}`}
        actions={<Link href="/expenses/new" className="btn-primary">+ Add entry</Link>}
      />

      {monthValid && (() => {
        const monthName = new Date(monthStartIso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Stat label={`Opening (${monthName})`} value={mmk(openingBalance)} tone={openingBalance >= 0 ? 'good' : 'bad'} />
            <Stat label="+ Income (month)" value={mmk(monthIncome)} tone="good" />
            <Stat label="− Expense (month)" value={mmk(monthExpense)} tone="bad" />
            <Stat label="= Closing balance" value={mmk(closingBalance)} tone={closingBalance >= 0 ? 'good' : 'bad'} />
          </div>
        );
      })()}

      <form className="flex gap-2 mb-4 flex-wrap">
        <input name="month" type="month" defaultValue={month} className="input max-w-[180px]" />
        <select name="account" defaultValue={account} className="input max-w-[280px]">
          <option value="all">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>[{a.category}] {a.group_name}</option>)}
        </select>
        <input name="q" defaultValue={q} placeholder="Search description…" className="input max-w-xs" />
        <button className="btn-ghost">Filter</button>
        {(month || account !== 'all' || q) && <a href="/expenses" className="btn-ghost">Clear</a>}
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>#</th><th>Date</th><th>Description</th><th>Account</th><th className="text-right">Income</th><th className="text-right">Expense</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {(entries ?? []).map((e) => {
                const acct = e.account as unknown as { group_name: string } | null;
                const product = e.product as unknown as { id: number; name: string; kind: string } | null;
                const income = (e.income_cash ?? 0) + (e.income_kpay ?? 0);
                const expense = (e.expense_cash ?? 0) + (e.expense_kpay ?? 0);
                const del = deleteRow.bind(null, 'ledger_entries', e.id, '/expenses');
                return (
                  <tr key={e.id}>
                    <td className="text-slate-400">{e.id}</td>
                    <td>{shortDate(e.entry_date)}</td>
                    <td className="max-w-xs truncate" title={e.description ?? ''}>
                      {e.description ?? '—'}
                      {product && (
                        <div className="text-[10px] text-brand-600 mt-0.5">📦 {product.name}{e.qty ? ` × ${e.qty}` : ''}</div>
                      )}
                    </td>
                    <td>{acct?.group_name ?? '—'}</td>
                    <td className="tabular-nums text-emerald-700">{income > 0 ? mmk(income) : '—'}</td>
                    <td className="tabular-nums text-rose-700">{expense > 0 ? mmk(expense) : '—'}</td>
                    <td className="text-right">
                      <Link href={`/expenses/${e.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <DeleteButton action={del} />
                    </td>
                  </tr>
                );
              })}
              {(entries?.length ?? 0) === 0 && (
                <tr><td colSpan={7} className="text-slate-500 text-sm py-6 text-center">No entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/expenses" query={{ month, account, q }} />
      </div>
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
