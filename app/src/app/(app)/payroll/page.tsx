import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { mmk } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';


async function generateFromSchedule(monthIso: string) {
  'use server';
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('generate_payslips_from_schedule', { target_month: monthIso });
  if (error) throw new Error(error.message);
  revalidatePath('/payroll');
  redirect(`/payroll?month=${monthIso.slice(0,7)}&generated=${data ?? 0}`);
}

async function markPaid(id: number, monthStr: string) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('employee_payslips')
    .update({ paid_at: new Date().toISOString().slice(0, 10) })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/payroll');
  redirect(`/payroll?month=${monthStr}`);
}

async function unmarkPaid(id: number, monthStr: string) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.from('employee_payslips')
    .update({ paid_at: null })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/payroll');
  redirect(`/payroll?month=${monthStr}`);
}

// Delete every payslip for the month — undo for an accidental Generate.
async function deleteAllPayslips(monthStr: string) {
  'use server';
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return;
  const supabase = await createClient();
  const { error } = await supabase.from('employee_payslips').delete().eq('pay_month', `${monthStr}-01`);
  if (error) throw new Error(error.message);
  revalidatePath('/payroll');
  redirect(`/payroll?month=${monthStr}`);
}

function pickMonth(s: string | undefined, fallback: string) {
  if (s && /^\d{4}-\d{2}$/.test(s)) return s + '-01';
  return fallback;
}

export default async function PayrollPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; generated?: string }> }) {
  const sp = await searchParams;
  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const monthIso = pickMonth(sp.month, defaultMonth);
  const monthLabel = new Date(monthIso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const generated = sp.generated ? Number(sp.generated) : null;
  const genAction = generateFromSchedule.bind(null, monthIso);

  const supabase = await createClient();
  const { data: payslips } = await supabase
    .from('employee_payslips')
    .select(`
      id, mt_hours, ct_hours, mt_absence_hrs, ct_absence_hrs,
      mt_hourly_fee, ct_hourly_fee,
      esl_pay, management_pay, guide_pay, summer_pay, other_pay, total_pay,
      paid_at, payment_method,
      employee:employees(id, short_name, full_name, category)
    `)
    .eq('pay_month', monthIso)
    .order('id');

  const totals = (payslips ?? []).reduce(
    (acc, p) => {
      acc.esl       += Number(p.esl_pay ?? 0);
      acc.mgmt      += Number(p.management_pay ?? 0);
      acc.guide     += Number(p.guide_pay ?? 0);
      acc.summer    += Number(p.summer_pay ?? 0);
      acc.other     += Number(p.other_pay ?? 0);
      acc.total     += Number(p.total_pay ?? 0);
      acc.mtHrs     += Number(p.mt_hours ?? 0);
      acc.ctHrs     += Number(p.ct_hours ?? 0);
      acc.absences  += Number(p.mt_absence_hrs ?? 0) + Number(p.ct_absence_hrs ?? 0);
      if (p.paid_at) acc.paid += Number(p.total_pay ?? 0);
      else acc.unpaid += Number(p.total_pay ?? 0);
      return acc;
    },
    { esl: 0, mgmt: 0, guide: 0, summer: 0, other: 0, total: 0, mtHrs: 0, ctHrs: 0, absences: 0, paid: 0, unpaid: 0 },
  );
  const paidCount = (payslips ?? []).filter((p) => p.paid_at).length;

  return (
    <div className="page">
      <PageHeader
        title="Payroll"
        subtitle={`${monthLabel} · ${payslips?.length ?? 0} payslips · total ${mmk(totals.total)}`}
        actions={<Link href={`/payroll/new?month=${monthIso.slice(0,7)}`} className="btn-primary">+ Add payslip</Link>}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <form className="flex gap-2 items-center">
          <input name="month" type="month" defaultValue={monthIso.slice(0,7)} className="input max-w-[180px]" />
          <button className="btn-ghost">View month</button>
        </form>
        <form action={genAction}>
          <button type="submit" className="btn-primary" title="Compute MT/CT hours from the schedule (× Sat/Sun count) with absence deductions. Re-running overwrites auto-computed fields; mgmt/guide/summer/other are preserved.">
            Generate for {monthLabel}
          </button>
        </form>
        <DeleteButton
          action={deleteAllPayslips.bind(null, monthIso.slice(0, 7))}
          label="Delete all"
          description={`Delete ALL payslips for ${monthLabel} (use this to undo an accidental Generate). Cannot be undone.`}
          className="btn-ghost text-rose-600"
        />
        {generated !== null && (
          <span className="text-xs text-emerald-700">✓ {generated.toLocaleString()} payslips written.</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <BigStat label={`Total payroll · ${payslips?.length ?? 0} payslips`} value={mmk(totals.total)} tone="default" />
        <BigStat label={`Paid · ${paidCount}`} value={mmk(totals.paid)} tone="good" />
        <BigStat label={`Unpaid · ${(payslips?.length ?? 0) - paidCount}`} value={mmk(totals.unpaid)} tone="bad" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <SmallStat label="ESL" value={mmk(totals.esl)} />
        <SmallStat label="Management" value={mmk(totals.mgmt)} />
        <SmallStat label="Guide" value={mmk(totals.guide)} />
        <SmallStat label="Summer" value={mmk(totals.summer)} />
        <SmallStat label="Other" value={mmk(totals.other)} />
        <SmallStat label="Hours / Absences" value={`${totals.mtHrs + totals.ctHrs} / ${totals.absences}`} />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>Teacher</th>
              <th className="text-right">MT hrs</th>
              <th className="text-right">CT hrs</th>
              <th className="text-right">Abs</th>
              <th className="text-right">MT fee</th>
              <th className="text-right">CT fee</th>
              <th className="text-right">ESL</th>
              <th className="text-right">Mgmt</th>
              <th className="text-right">Guide</th>
              <th className="text-right">Summer</th>
              <th className="text-right">Other</th>
              <th className="text-right">Total</th>
              <th>Paid</th>
              <th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {(payslips ?? []).map((p) => {
                const e = p.employee as unknown as { id: number; short_name: string } | null;
                const del = deleteRow.bind(null, 'employee_payslips', p.id, '/payroll');
                const absTotal = Number(p.mt_absence_hrs ?? 0) + Number(p.ct_absence_hrs ?? 0);
                return (
                  <tr key={p.id}>
                    <td className="font-medium">
                      {e ? <Link href={`/employees/${e.id}`} className="text-brand-600 hover:underline">{e.short_name}</Link> : '—'}
                    </td>
                    <td className="text-right tabular-nums">{Number(p.mt_hours ?? 0)}</td>
                    <td className="text-right tabular-nums">{Number(p.ct_hours ?? 0)}</td>
                    <td className={`text-right tabular-nums ${absTotal > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{absTotal || '—'}</td>
                    <td className="text-right tabular-nums text-xs text-slate-500">{mmk(p.mt_hourly_fee)}</td>
                    <td className="text-right tabular-nums text-xs text-slate-500">{mmk(p.ct_hourly_fee)}</td>
                    <td className="text-right tabular-nums">{Number(p.esl_pay) > 0 ? mmk(p.esl_pay) : '—'}</td>
                    <td className="text-right tabular-nums">{Number(p.management_pay) > 0 ? mmk(p.management_pay) : '—'}</td>
                    <td className="text-right tabular-nums">{Number(p.guide_pay) > 0 ? mmk(p.guide_pay) : '—'}</td>
                    <td className="text-right tabular-nums">{Number(p.summer_pay) > 0 ? mmk(p.summer_pay) : '—'}</td>
                    <td className="text-right tabular-nums">{Number(p.other_pay) > 0 ? mmk(p.other_pay) : '—'}</td>
                    <td className="text-right tabular-nums font-semibold text-emerald-700">{mmk(p.total_pay)}</td>
                    <td className="text-xs">{p.paid_at ? <span className="badge-green">{p.paid_at}</span> : <span className="text-slate-400">unpaid</span>}</td>
                    <td className="text-right whitespace-nowrap">
                      {p.paid_at ? (
                        <form action={unmarkPaid.bind(null, p.id, monthIso.slice(0, 7))} className="inline mr-3">
                          <button type="submit" className="text-slate-500 hover:text-slate-700 text-xs">Unmark</button>
                        </form>
                      ) : (
                        <form action={markPaid.bind(null, p.id, monthIso.slice(0, 7))} className="inline mr-3">
                          <button type="submit" className="text-emerald-700 hover:underline text-xs">Mark paid</button>
                        </form>
                      )}
                      <Link href={`/payroll/${p.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <DeleteButton action={del} />
                    </td>
                  </tr>
                );
              })}
              {(payslips?.length ?? 0) === 0 && (
                <tr><td colSpan={14} className="text-slate-500 text-sm py-6 text-center">No payslips for {monthLabel}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, tone }: { label: string; value: string; tone: 'default' | 'good' | 'bad' }) {
  const cls = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div className="card py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${cls}`}>{value}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold tabular-nums leading-tight mt-0.5">{value}</div>
    </div>
  );
}
