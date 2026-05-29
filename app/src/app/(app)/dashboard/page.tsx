import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import StatCard from '@/components/stat-card';
import PLChart from '@/components/pl-chart';
import LevelChart from '@/components/level-chart';
import { mmk, monthLabel, shortDate } from '@/lib/format';


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

  // Students with open/partial invoices — pre-aggregated in one round-trip
  // (see dashboard_outstanding()), already sorted by amount owed desc.
  type OutstandingRow = {
    student_id: number; english_name: string | null; myanmar_name: string | null;
    open_invoices: number; outstanding: number; oldest_unpaid: string;
  };
  const { data: owingData } = await supabase.rpc('dashboard_outstanding');
  const owing = ((owingData as OutstandingRow[] | null) ?? []).map((r) => ({
    id: r.student_id,
    name: r.english_name ?? r.myanmar_name ?? `#${r.student_id}`,
    count: Number(r.open_invoices),
    outstanding: Number(r.outstanding),
    oldest: r.oldest_unpaid,
  }));
  const studentsOwing = owing.length;
  const totalOutstanding = owing.reduce((s, o) => s + o.outstanding, 0);

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

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
        <StatCard size="sm" label="Active" value={(d.students_active ?? 0).toLocaleString()} hint={`${totalStudents} total`} />
        <StatCard size="sm" label="On break" value={(d.students_break ?? 0).toLocaleString()} />
        <StatCard size="sm" label="Left" value={(d.students_left ?? 0).toLocaleString()} />
        <StatCard size="sm" label="Employees" value={(d.employees ?? 0).toLocaleString()} />
        <StatCard size="sm" label="Open invoices" value={(d.open_invoices ?? 0).toLocaleString()} tone={(d.open_invoices ?? 0) > 0 ? 'bad' : 'default'} />
        <StatCard size="sm" label="Students owing" value={studentsOwing.toLocaleString()} hint={mmk(totalOutstanding)} tone={studentsOwing > 0 ? 'bad' : 'default'} />
        <StatCard size="sm" label={`${year} net`} value={mmk(d.year_totals?.net ?? 0)} tone={(d.year_totals?.net ?? 0) >= 0 ? 'good' : 'bad'} />
        <StatCard size="sm" label="Month net" value={mmk(d.this_month?.net ?? 0)} tone={(d.this_month?.net ?? 0) >= 0 ? 'good' : 'bad'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">P&amp;L · {year}</div>
          <PLChart data={d.trend ?? []} />
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-2">Active students by level</div>
          <LevelChart data={levelChartData} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-500 font-medium">
            Students with open invoices ({studentsOwing.toLocaleString()})
          </span>
          {studentsOwing > 0 && (
            <Link href="/billing?status=open" className="text-brand-600 hover:underline text-xs">View in billing →</Link>
          )}
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>Student</th>
              <th className="text-right">Open invoices</th>
              <th>Oldest unpaid</th>
              <th className="text-right">Outstanding</th>
            </tr></thead>
            <tbody>
              {owing.slice(0, 50).map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">
                    <Link href={`/students/${o.id}`} className="text-brand-600 hover:underline">{o.name}</Link>
                  </td>
                  <td className="text-right tabular-nums">{o.count}</td>
                  <td>{shortDate(o.oldest)}</td>
                  <td className="text-right tabular-nums text-rose-700">{mmk(o.outstanding)}</td>
                </tr>
              ))}
              {studentsOwing === 0 && (
                <tr><td colSpan={4} className="text-slate-500 text-sm py-6 text-center">No students with open invoices — all settled. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {studentsOwing > 50 && (
          <div className="px-4 py-2 text-xs text-slate-500 border-t">Showing top 50 of {studentsOwing.toLocaleString()} by amount owed.</div>
        )}
      </div>
    </div>
  );
}
