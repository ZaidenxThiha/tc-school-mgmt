import { notFound } from 'next/navigation';
import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import { mmk, shortDate, monthLabel } from '@/lib/format';


const CATEGORY_LABEL: Record<string, string> = {
  esl_teacher:'ESL Teacher', admin_teacher:'Admin Teacher', admin_staff:'Admin Staff',
  helper:'Helper', security:'Security', cleaner:'Cleaner', driver:'Driver',
  accountant:'Accountant', owner:'Owner', other:'Other',
};

export default async function EmployeeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [eRows, payslips, assignments, absences, sectionLinks] = await Promise.all([
    sql`select * from employees where id = ${id}`,
    sql`select id, pay_month, mt_hours, ct_hours, mt_absence_hrs, ct_absence_hrs, esl_pay, management_pay, guide_pay, summer_pay, other_pay, total_pay,
          to_char(paid_at, 'YYYY-MM-DD') as paid_at
        from employee_payslips where employee_id = ${id} order by pay_month desc`,
    sql`select a.id, a.month, a.day_of_week, a.time_slot, a.class_label, a.subject,
          case when r.id is null then null else json_build_object('name', r.name, 'display_name', r.display_name) end as room
        from schedule_assignments a left join rooms r on r.id = a.room_id
        where a.mt_employee_id = ${id} or a.ct_employee_id = ${id}
        order by a.month desc, a.day_of_week, a.time_slot`,
    sql`select id, absent_date, hours, role, reason from absences where employee_id = ${id} order by absent_date desc`,
    sql`select t.section_id, t.weekday_pattern, t.teaching_role,
          json_build_object('id', sec.id, 'time_slot', sec.time_slot, 'is_online', sec.is_online, 'level', json_build_object('name', l.name)) as section
        from section_teachers t join sections sec on sec.id = t.section_id join levels l on l.id = sec.level_id
        where t.teacher_id = ${id}`,
  ]);

  const e = eRows[0] as unknown as Record<string, unknown> & {
    short_name: string; full_name: string; category: string; is_active: boolean; notes: string | null;
    phone: string | null; email: string | null; address: string | null; monthly_salary: number | null;
    mt_hourly_fee: number | null; ct_hourly_fee: number | null;
    date_of_birth: string | Date | null; national_id: string | null; position_title: string | null;
    education_level: string | null; degree: string | null; available_slots: string | null;
    emergency_contact: string | null; start_date: string | Date | null;
  } | undefined;
  if (!e) notFound();

  const totalPaid = (payslips ?? []).reduce((s, p) => s + Number(p.total_pay ?? 0), 0);
  const totalAbs  = (absences ?? []).reduce((s, a) => s + Number(a.hours ?? 0), 0);

  return (
    <div className="page">
      <PageHeader
        title={e.short_name}
        subtitle={`${e.full_name} · ${CATEGORY_LABEL[e.category] ?? e.category}`}
        actions={<Link href={`/employees/${id}/edit`} className="btn-primary">Edit</Link>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <SmallStat label="Total paid" value={mmk(totalPaid)} tone="good" />
        <SmallStat label="Payslips" value={(payslips?.length ?? 0).toString()} />
        <SmallStat label="Absences (hrs)" value={totalAbs.toString()} tone={totalAbs > 0 ? 'bad' : 'default'} />
        <SmallStat label="Schedule slots" value={(assignments?.length ?? 0).toString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="card">
          <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Profile</div>
          <dl className="grid grid-cols-3 gap-y-1.5 text-sm">
            <Row k="Phone"     v={e.phone} />
            <Row k="Email"     v={e.email} />
            <Row k="Address"   v={e.address} />
            <Row k="DOB"       v={shortDate(e.date_of_birth)} />
            <Row k="NRC"       v={e.national_id} />
            <Row k="Position"  v={e.position_title} />
            <Row k="Education" v={e.education_level} />
            <Row k="Degree"    v={e.degree} />
            <Row k="Slots"     v={e.available_slots} />
            <Row k="Emergency" v={e.emergency_contact} />
            <Row k="Started"   v={shortDate(e.start_date)} />
            <Row k="Salary/mo" v={e.monthly_salary ? mmk(e.monthly_salary) : null} />
            <Row k="MT fee/hr" v={e.mt_hourly_fee ? mmk(e.mt_hourly_fee) : null} />
            <Row k="CT fee/hr" v={e.ct_hourly_fee ? mmk(e.ct_hourly_fee) : null} />
            <Row k="Status"    v={e.is_active ? 'Active' : 'Inactive'} />
          </dl>
          {e.notes && <div className="mt-3 text-xs text-slate-600 border-t pt-2">{e.notes}</div>}
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b font-medium text-sm">Payslips</div>
          <div className="overflow-auto max-h-[300px]">
            <table className="table">
              <thead><tr><th>Month</th><th>MT/CT hrs</th><th>Abs</th><th className="text-right">Total</th><th>Paid</th></tr></thead>
              <tbody>
                {(payslips ?? []).map((p) => {
                  const abs = Number(p.mt_absence_hrs ?? 0) + Number(p.ct_absence_hrs ?? 0);
                  return (
                    <tr key={p.id}>
                      <td className="text-xs">{monthLabel(p.pay_month)}</td>
                      <td className="text-xs tabular-nums">{Number(p.mt_hours ?? 0)}/{Number(p.ct_hours ?? 0)}</td>
                      <td className="text-xs tabular-nums text-rose-600">{abs > 0 ? abs : '—'}</td>
                      <td className="text-right text-xs tabular-nums font-semibold">{mmk(p.total_pay)}</td>
                      <td className="text-xs">{p.paid_at ?? <span className="text-slate-400">—</span>}</td>
                    </tr>
                  );
                })}
                {(payslips?.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="text-slate-500 text-xs py-4 text-center">No payslips.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b font-medium text-sm">Schedule assignments</div>
          <div className="overflow-auto max-h-[400px]">
            <table className="table">
              <thead><tr><th>Month</th><th>Day</th><th>Slot</th><th>Class</th><th>Room</th></tr></thead>
              <tbody>
                {(assignments ?? []).map((a) => {
                  const r = a.room as unknown as { name: string; display_name: string | null } | null;
                  return (
                    <tr key={a.id}>
                      <td className="text-xs">{new Date(a.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</td>
                      <td className="text-xs">{a.day_of_week}</td>
                      <td className="text-xs">{a.time_slot}</td>
                      <td className="text-xs">{a.class_label ?? '—'}</td>
                      <td className="text-xs">{r ? `${r.name}${r.display_name ? ` (${r.display_name})` : ''}` : '—'}</td>
                    </tr>
                  );
                })}
                {(assignments?.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="text-slate-500 text-xs py-4 text-center">No assignments.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b font-medium text-sm">Absences ({absences?.length ?? 0})</div>
          <div className="overflow-auto max-h-[300px]">
            <table className="table">
              <thead><tr><th>Date</th><th className="text-right">Hours</th><th>Role</th><th>Reason</th></tr></thead>
              <tbody>
                {(absences ?? []).map((a) => (
                  <tr key={a.id}>
                    <td className="text-xs">{shortDate(a.absent_date)}</td>
                    <td className="text-xs tabular-nums text-rose-600">{a.hours}</td>
                    <td className="text-xs">{a.role}</td>
                    <td className="text-xs text-slate-600">{a.reason ?? '—'}</td>
                  </tr>
                ))}
                {(absences?.length ?? 0) === 0 && (
                  <tr><td colSpan={4} className="text-slate-500 text-xs py-4 text-center">No absences logged.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-0 overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b font-medium text-sm">Sections currently assigned</div>
          <div className="overflow-auto">
            <table className="table">
              <thead><tr><th>Section</th><th>Time</th><th>Mode</th><th>Pattern</th><th>Role</th></tr></thead>
              <tbody>
                {(sectionLinks ?? []).map((s) => {
                  const sec = s.section as unknown as { id: number; time_slot: string; is_online: boolean; level: { name: string } | null } | null;
                  if (!sec) return null;
                  return (
                    <tr key={s.section_id}>
                      <td className="text-sm font-medium">
                        <Link href={`/sections/${sec.id}`} className="text-brand-600 hover:underline">{sec.level?.name ?? '—'}</Link>
                      </td>
                      <td className="text-xs">{sec.time_slot}</td>
                      <td className="text-xs">{sec.is_online ? 'Online' : 'In-person'}</td>
                      <td className="text-xs">{s.weekday_pattern ?? '—'}</td>
                      <td className="text-xs">{s.teaching_role ?? '—'}</td>
                    </tr>
                  );
                })}
                {(sectionLinks?.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="text-slate-500 text-xs py-4 text-center">Not assigned to any section.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-6">
        <Link href="/employees" className="text-sm text-slate-500 hover:text-slate-700">← Back to employees</Link>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <>
      <dt className="text-slate-500 text-xs">{k}</dt>
      <dd className="col-span-2 text-slate-900 text-xs">{v ?? <span className="text-slate-300">—</span>}</dd>
    </>
  );
}

function SmallStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'bad' }) {
  const cls = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div className="bg-white border border-slate-200 rounded-md px-3 py-2">
      <div className="text-[10px] uppercase text-slate-500 tracking-wide">{label}</div>
      <div className={`text-base font-semibold tabular-nums leading-tight mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}
