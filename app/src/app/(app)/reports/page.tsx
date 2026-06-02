import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import PLChart from '@/components/pl-chart';
import { mmk, monthLabel } from '@/lib/format';


export default async function ReportsPage({
  searchParams,
}: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getUTCFullYear());

  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year + 1}-01-01`;

  const [pl, expAcctRows, levelSectionRows, noSectionRows, kindRows] = await Promise.all([
    sql`select to_char(month, 'YYYY-MM-DD') as month, income, expense, net
        from v_monthly_pl where month >= ${yearStart} and month < ${yearEnd} order by month`,
    sql`select coalesce(coa.group_name, '(uncategorized)') as k,
          sum(e.expense_cash + e.expense_kpay)::bigint as v
        from ledger_entries e left join chart_of_accounts coa on coa.id = e.account_id
        where e.entry_date >= ${yearStart} and e.entry_date < ${yearEnd}
        group by 1 having sum(e.expense_cash + e.expense_kpay) > 0 order by v desc`,
    sql`select coalesce(l.name, '(unassigned section)') as k, sum(i.total_amount)::bigint as v
        from invoices i join sections s on s.id = i.section_id join levels l on l.id = s.level_id
        where i.status = 'paid' and i.section_id is not null
          and i.billing_month >= ${yearStart} and i.billing_month < ${yearEnd}
        group by 1`,
    sql`with inv as (
          select il.invoice_id, sum(il.amount) as total,
            bool_or(il.kind = 'guide') as has_guide,
            bool_or(il.kind = 'book') as has_book,
            bool_or(il.kind = 'class_fee') as has_class
          from invoice_lines il join invoices i on i.id = il.invoice_id
          where i.status = 'paid' and i.section_id is null
            and i.billing_month >= ${yearStart} and i.billing_month < ${yearEnd}
          group by il.invoice_id)
        select case when has_guide then 'Guide Class'
                    when has_book and not has_class then 'Book Fee from Students'
                    when has_class then '(unassigned section)'
                    else 'Other Student Fees' end as k,
               sum(total)::bigint as v
        from inv group by 1`,
    sql`select il.kind, sum(il.amount)::bigint as v
        from invoice_lines il join invoices i on i.id = il.invoice_id
        where i.status = 'paid' and i.billing_month >= ${yearStart} and i.billing_month < ${yearEnd}
        group by il.kind`,
  ]) as unknown as [
    { month: string; income: number; expense: number; net: number }[],
    { k: string; v: number }[],
    { k: string; v: number }[],
    { k: string; v: number }[],
    { kind: string; v: number }[],
  ];

  const acctSorted = expAcctRows.map((r) => [r.k, Number(r.v)] as [string, number]).sort((a, b) => b[1] - a[1]);

  // Revenue by level — section-based plus bucketed section-less fees
  const byLevel: Record<string, number> = {};
  for (const r of levelSectionRows) byLevel[r.k] = (byLevel[r.k] ?? 0) + Number(r.v);
  for (const r of noSectionRows) byLevel[r.k] = (byLevel[r.k] ?? 0) + Number(r.v);
  const levelSorted = Object.entries(byLevel).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  // Revenue by fee type (every paid invoice line in the year)
  const KIND_LABEL: Record<string, string> = {
    class_fee: 'Class Fee',
    book:      'Book Fee',
    id:        'ID Card',
    tshirt:    'T-Shirt',
    guide:     'Guide Fee',
    fine:      'Fine',
    discount:  'Discount',
    other:     'Other',
  };
  const byKind: Record<string, number> = {};
  for (const r of kindRows) {
    const k = KIND_LABEL[r.kind] ?? r.kind;
    byKind[k] = (byKind[k] ?? 0) + Number(r.v);
  }
  const kindSorted = Object.entries(byKind)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  const trendData = (pl ?? []).map((r) => {
    const d = new Date(r.month as string);
    return {
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      income: Number(r.income ?? 0),
      expense: Number(r.expense ?? 0),
      net: Number(r.net ?? 0),
    };
  });

  const totIncome  = trendData.reduce((s, r) => s + r.income, 0);
  const totExpense = trendData.reduce((s, r) => s + r.expense, 0);

  return (
    <div className="page">
      <PageHeader title="Reports" subtitle={`Fiscal year ${year}`} />

      <form className="flex gap-2 mb-6">
        <input name="year" type="number" min="2024" max="2030" defaultValue={year} className="input max-w-[120px]" />
        <button className="btn-ghost">View year</button>
      </form>

      <div className="card mb-6">
        <div className="font-medium mb-3">Monthly P&amp;L — {year}</div>
        <PLChart data={trendData} />
        <div className="mt-3 text-sm text-slate-600">
          Total income {mmk(totIncome)} · Total expense {mmk(totExpense)} ·
          Net <span className={totIncome - totExpense >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
            {mmk(totIncome - totExpense)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b font-medium">Expense by account ({year})</div>
          <table className="table">
            <thead><tr><th>Account</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {acctSorted.map(([k, v]) => (
                <tr key={k}><td>{k}</td><td className="text-right tabular-nums">{mmk(v)}</td></tr>
              ))}
              {acctSorted.length === 0 && <tr><td colSpan={2} className="text-slate-500 text-sm py-4 text-center">No data.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b font-medium">Revenue by level ({year}, paid invoices)</div>
          <table className="table">
            <thead><tr><th>Level</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>
              {levelSorted.map(([k, v]) => (
                <tr key={k}><td>{k}</td><td className="text-right tabular-nums">{mmk(v)}</td></tr>
              ))}
              {levelSorted.length === 0 && <tr><td colSpan={2} className="text-slate-500 text-sm py-4 text-center">No data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-0 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b font-medium">Revenue by fee type ({year})</div>
        <table className="table">
          <thead><tr><th>Fee type</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {kindSorted.map(([k, v]) => (
              <tr key={k}>
                <td className={k === 'Discount' ? 'text-emerald-700' : k === 'Fine' ? 'text-rose-700' : ''}>{k}</td>
                <td className="text-right tabular-nums">{mmk(v)}</td>
              </tr>
            ))}
            {kindSorted.length === 0 && <tr><td colSpan={2} className="text-slate-500 text-sm py-4 text-center">No data.</td></tr>}
            {kindSorted.length > 0 && (
              <tr className="font-semibold border-t-2 border-slate-300">
                <td>Total</td>
                <td className="text-right tabular-nums">{mmk(kindSorted.reduce((s, [, v]) => s + v, 0))}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">Monthly breakdown ({year})</div>
        <table className="table">
          <thead><tr><th>Month</th><th className="text-right">Income</th><th className="text-right">Expense</th><th className="text-right">Net</th></tr></thead>
          <tbody>
            {(pl ?? []).map((r) => {
              const net = Number(r.net ?? 0);
              return (
                <tr key={r.month as string}>
                  <td className="font-medium">{monthLabel(r.month as string)}</td>
                  <td className="tabular-nums text-emerald-700 text-right">{mmk(r.income)}</td>
                  <td className="tabular-nums text-rose-700 text-right">{mmk(r.expense)}</td>
                  <td className={`tabular-nums font-medium text-right ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{mmk(net)}</td>
                </tr>
              );
            })}
            {(pl?.length ?? 0) === 0 && (
              <tr><td colSpan={4} className="text-slate-500 text-sm py-6 text-center">No data for {year}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
