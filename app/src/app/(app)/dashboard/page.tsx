import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/stat-card';
import PLChart from '@/components/pl-chart';
import LevelChart from '@/components/level-chart';
import { mmk, monthLabel } from '@/lib/format';


type DashboardData = {
  fiscal_year: number;
  this_month_start: string;
  students_active: number;
  students_break: number;
  students_left: number;
  employees: number;
  open_invoices: number;
  this_month: { income: number; expense: number; net: number; cash: number; kpay: number };
  year_totals: { income: number; expense: number; net: number; cash: number; kpay: number };
  trend: { month: string; income: number; expense: number; net: number }[];
  level_counts: Record<string, number>;
};

export default async function DashboardPage({
  searchParams,
}: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const year = Number(sp.year ?? currentYear);

  const { data, error } = await supabase.rpc('dashboard_data', { target_year: year });
  const d = (data as DashboardData | null) ?? {
    fiscal_year: year, this_month_start: new Date().toISOString().slice(0,10),
    students_active: 0, students_break: 0, students_left: 0, employees: 0, open_invoices: 0,
    this_month: { income: 0, expense: 0, net: 0, cash: 0, kpay: 0 },
    year_totals: { income: 0, expense: 0, net: 0, cash: 0, kpay: 0 },
    trend: [], level_counts: {},
  };

  const monthStart = new Date(d.this_month_start);
  const totalStudents = (d.students_active ?? 0) + (d.students_break ?? 0) + (d.students_left ?? 0);

  const LEVEL_ORDER = ['EARLY_CHILDHOOD','NURSERY','PRE_STARTER','STARTER','MOVERS','FLYERS','KEY','PET','FCE','CAE'];
  const levelChartData = LEVEL_ORDER
    .filter((k) => (d.level_counts?.[k] ?? 0) > 0)
    .map((k) => ({
      code: k.replace('EARLY_CHILDHOOD','EarlyCh').replace('PRE_STARTER','PreSt').replace('_',''),
      active: d.level_counts[k] ?? 0,
    }));

  const yearOptions = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

  return (
    <div className="px-6 py-5">
      <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
        <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
        <form className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Year</label>
          <select name="year" defaultValue={year} className="text-sm rounded-md border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500/40">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn-ghost text-xs px-3 py-1">Apply</button>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-500">{monthLabel(monthStart)}</span>
        </form>
      </div>

      {error && <div className="card text-rose-700 text-sm mb-3">{error.message}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        <StatCard size="sm" label="Active" value={(d.students_active ?? 0).toLocaleString()} hint={`${totalStudents} total`} />
        <StatCard size="sm" label="On break" value={(d.students_break ?? 0).toLocaleString()} />
        <StatCard size="sm" label="Left" value={(d.students_left ?? 0).toLocaleString()} />
        <StatCard size="sm" label="Employees" value={(d.employees ?? 0).toLocaleString()} />
        <StatCard size="sm" label="Open invoices" value={(d.open_invoices ?? 0).toLocaleString()} tone={(d.open_invoices ?? 0) > 0 ? 'bad' : 'default'} />
        <StatCard size="sm" label={`${year} net`} value={mmk(d.year_totals?.net ?? 0)} tone={(d.year_totals?.net ?? 0) >= 0 ? 'good' : 'bad'} />
        <StatCard size="sm" label="Month net" value={mmk(d.this_month?.net ?? 0)} tone={(d.this_month?.net ?? 0) >= 0 ? 'good' : 'bad'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-white border border-slate-200 rounded-md p-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{monthLabel(monthStart)}</div>
          <div className="grid grid-cols-3 gap-2">
            <Row label="Income"  value={mmk(d.this_month.income)} cls="text-emerald-700" />
            <Row label="Expense" value={mmk(d.this_month.expense)} cls="text-rose-700" />
            <Row label="Net"     value={mmk(d.this_month.net)}     cls={d.this_month.net >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
            <Row label="Cash"    value={mmk(d.this_month.cash)} />
            <Row label="KPay"    value={mmk(d.this_month.kpay)} />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-md p-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Year {year}</div>
          <div className="grid grid-cols-3 gap-2">
            <Row label="Income"  value={mmk(d.year_totals.income)}  cls="text-emerald-700" />
            <Row label="Expense" value={mmk(d.year_totals.expense)} cls="text-rose-700" />
            <Row label="Net"     value={mmk(d.year_totals.net)}     cls={d.year_totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
            <Row label="Cash"    value={mmk(d.year_totals.cash)} />
            <Row label="KPay"    value={mmk(d.year_totals.kpay)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-md p-3 lg:col-span-2">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{year - 1}–{year} income · expense · net</div>
          <PLChart data={d.trend ?? []} />
        </div>
        <div className="bg-white border border-slate-200 rounded-md p-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Active students by level</div>
          <LevelChart data={levelChartData} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, cls = 'text-slate-900' }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
