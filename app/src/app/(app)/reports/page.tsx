import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import PLChart from '@/components/pl-chart';
import { mmk, monthLabel } from '@/lib/format';


export default async function ReportsPage({
  searchParams,
}: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getUTCFullYear());

  const supabase = await createClient();
  const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString();
  const yearEnd   = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

  const [{ data: pl }, { data: expByAcct }, { data: incByLevel }, { data: noSectionLines }, { data: allLines }] = await Promise.all([
    supabase.from('v_monthly_pl').select('month,income,expense,net').gte('month', yearStart).lt('month', yearEnd).order('month'),
    supabase.from('ledger_entries')
      .select('expense_cash, expense_kpay, account:chart_of_accounts(group_name, category)')
      .gte('entry_date', yearStart.slice(0,10)).lt('entry_date', yearEnd.slice(0,10)),
    supabase.from('invoices').select('id, total_amount, billing_month, section_id, section:sections(level:levels(code, name))').gte('billing_month', yearStart.slice(0,10)).lt('billing_month', yearEnd.slice(0,10)).eq('status', 'paid').limit(5000),
    supabase.from('invoice_lines')
      .select('amount, kind, invoice:invoices!inner(id, billing_month, section_id, status)')
      .is('invoice.section_id', null)
      .eq('invoice.status', 'paid')
      .gte('invoice.billing_month', yearStart.slice(0,10))
      .lt('invoice.billing_month', yearEnd.slice(0,10))
      .limit(5000),
    // Every paid invoice line in the year — grouped by kind
    supabase.from('invoice_lines')
      .select('amount, kind, invoice:invoices!inner(billing_month, status)')
      .eq('invoice.status', 'paid')
      .gte('invoice.billing_month', yearStart.slice(0,10))
      .lt('invoice.billing_month', yearEnd.slice(0,10))
      .limit(20000),
  ]);

  // Aggregate expense by account
  const byAcct: Record<string, number> = {};
  for (const r of expByAcct ?? []) {
    const a = r.account as unknown as { group_name: string } | null;
    const k = a?.group_name ?? '(uncategorized)';
    byAcct[k] = (byAcct[k] ?? 0) + Number(r.expense_cash ?? 0) + Number(r.expense_kpay ?? 0);
  }
  const acctSorted = Object.entries(byAcct)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  // Aggregate revenue by level — only invoices that ARE assigned to a section
  const byLevel: Record<string, number> = {};
  for (const r of incByLevel ?? []) {
    if (!r.section_id) continue;
    const sec = r.section as unknown as { level: { code: string; name: string } | null } | null;
    const k = sec?.level?.name ?? '(unassigned section)';
    byLevel[k] = (byLevel[k] ?? 0) + Number(r.total_amount ?? 0);
  }

  // Bucket section-less invoice lines into Guide / Book / Other student fees
  const linesByInv: Map<number, { kind: string; amount: number }[]> = new Map();
  for (const r of noSectionLines ?? []) {
    const inv = r.invoice as unknown as { id: number } | null;
    if (!inv) continue;
    if (!linesByInv.has(inv.id)) linesByInv.set(inv.id, []);
    linesByInv.get(inv.id)!.push({ kind: r.kind as string, amount: Number(r.amount ?? 0) });
  }
  for (const [, lines] of linesByInv) {
    const kinds = new Set(lines.map((l) => l.kind));
    const total = lines.reduce((s, l) => s + l.amount, 0);
    let cat = 'Other Student Fees';
    if (kinds.has('guide')) cat = 'Guide Class';
    else if (kinds.has('book') && !kinds.has('class_fee')) cat = 'Book Fee from Students';
    else if (kinds.has('class_fee')) cat = '(unassigned section)';
    byLevel[cat] = (byLevel[cat] ?? 0) + total;
  }

  const levelSorted = Object.entries(byLevel)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

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
  for (const r of allLines ?? []) {
    const k = KIND_LABEL[r.kind as string] ?? (r.kind as string);
    byKind[k] = (byKind[k] ?? 0) + Number(r.amount ?? 0);
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
