import { notFound } from 'next/navigation';
import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import { mmk, shortDate } from '@/lib/format';
import PayInFullButton from '@/components/pay-in-full-button';
import DeleteButton from '@/components/delete-button';
import { deleteInvoice } from '@/lib/actions/invoice';


export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const [studentRows, enrolments, invoices, payments, outRows] = await Promise.all([
    sql`select s.*, case when g.id is null then null else
           json_build_object('full_name',g.full_name,'phone_primary',g.phone_primary,'phone_secondary',g.phone_secondary,'viber_number',g.viber_number) end as guardian
        from students s left join guardians g on g.id = s.guardian_id where s.id = ${id}`,
    sql`select e.id, e.start_date, e.end_date, e.status,
           json_build_object('time_slot', sec.time_slot, 'is_online', sec.is_online, 'level', json_build_object('name', l.name)) as section
        from enrolments e join sections sec on sec.id = e.section_id join levels l on l.id = sec.level_id
        where e.student_id = ${id} order by e.start_date desc`,
    sql`select id, billing_month, total_amount, status from invoices where student_id = ${id} order by billing_month desc limit 12`,
    sql`select id, paid_at, amount, channel from payments where student_id = ${id} order by paid_at desc limit 12`,
    sql`select coalesce(sum(greatest(0, i.total_amount - coalesce(pp.paid, 0))), 0)::bigint as outstanding
        from invoices i left join lateral (select sum(amount) as paid from payments where invoice_id = i.id) pp on true
        where i.student_id = ${id} and i.status in ('open','partial')`,
  ]);

  const student = studentRows[0] as unknown as {
    id: number; english_name: string | null; myanmar_name: string | null; current_status: string;
    enrolled_at: string | Date | null; notes: string | null;
    guardian: { full_name?: string; phone_primary?: string; phone_secondary?: string; viber_number?: string } | null;
  } | undefined;
  if (!student) notFound();
  const guardian = student.guardian;
  const outstanding = Number(outRows[0]?.outstanding ?? 0);

  return (
    <div className="page">
      <PageHeader
        title={student.english_name ?? `Student #${student.id}`}
        subtitle={student.myanmar_name ?? '—'}
        actions={
          <div className="flex gap-2">
            <Link href={`/enrolments/new?student=${student.id}`} className="btn-primary">+ Enroll</Link>
            <Link href={`/billing/new?student=${student.id}`} className="btn-ghost">+ Invoice</Link>
            <Link href={`/payments/new?student=${student.id}`} className="btn-ghost">+ Payment</Link>
            <Link href={`/students/${student.id}/edit`} className="btn-ghost">Edit</Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="text-xs uppercase text-slate-500 font-medium">Status</div>
          <div className="text-xl font-semibold mt-1">{student.current_status}</div>
          <div className="text-xs text-slate-500 mt-2">Enrolled {shortDate(student.enrolled_at)}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-slate-500 font-medium">Guardian</div>
          <div className="mt-1 text-sm">
            <div>{guardian?.full_name ?? '—'}</div>
            <div className="text-slate-500">{guardian?.phone_primary ?? '—'}{guardian?.phone_secondary ? ` / ${guardian.phone_secondary}` : ''}</div>
            <div className="text-slate-500">Viber: {guardian?.viber_number ?? '—'}</div>
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase text-slate-500 font-medium">Outstanding</div>
          <div className={`text-xl font-semibold mt-1 tabular-nums ${outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{mmk(outstanding)}</div>
          <div className="text-xs text-slate-500 mt-2">{outstanding > 0 ? 'Unpaid across open invoices' : 'All invoices settled'}</div>
        </div>
      </div>

      {student.notes && (
        <div className="card mb-6">
          <div className="text-xs uppercase text-slate-500 font-medium">Notes</div>
          <div className="mt-1 text-sm text-slate-600">{student.notes}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-medium flex items-center justify-between">
            <span>Enrolment history</span>
            <Link href={`/enrolments/new?student=${student.id}`} className="text-brand-600 hover:underline text-xs font-normal">+ Enroll</Link>
          </div>
          <table className="table">
            <thead><tr><th>Section</th><th>Status</th><th>Start</th><th>End</th></tr></thead>
            <tbody>
              {(enrolments ?? []).map((e) => {
                const section = e.section as unknown as { time_slot: string; is_online: boolean; level: { name: string } | null } | null;
                const label = section ? `${section.level?.name ?? '?'} (${section.time_slot})${section.is_online ? ' Online' : ''}` : '—';
                return (
                  <tr key={e.id}>
                    <td>{label}</td>
                    <td>{e.status}</td>
                    <td>{shortDate(e.start_date)}</td>
                    <td>{shortDate(e.end_date)}</td>
                  </tr>
                );
              })}
              {(enrolments?.length ?? 0) === 0 && <tr><td colSpan={4} className="text-slate-500 text-sm py-4 text-center">No enrolments</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-medium flex items-center justify-between">
            <span>Recent invoices</span>
            <Link href={`/billing/new?student=${student.id}`} className="text-brand-600 hover:underline text-xs font-normal">+ Invoice</Link>
          </div>
          <table className="table">
            <thead><tr><th>Month</th><th className="text-right">Total</th><th>Status</th><th className="text-right">Action</th></tr></thead>
            <tbody>
              {(invoices ?? []).map((i) => {
                const badge =
                  i.status === 'paid'    ? 'badge-green' :
                  i.status === 'partial' ? 'badge-amber' :
                  i.status === 'void'    ? 'badge-slate' : 'badge-rose';
                const payable = i.status === 'open' || i.status === 'partial';
                return (
                  <tr key={i.id}>
                    <td>{shortDate(i.billing_month)}</td>
                    <td className="text-right tabular-nums">{mmk(i.total_amount)}</td>
                    <td><span className={badge}>{i.status}</span></td>
                    <td className="text-right whitespace-nowrap">
                      {payable && <PayInFullButton invoiceId={i.id} amountLabel={mmk(i.total_amount)} />}
                      <span className="ml-3 inline-block align-middle">
                        <DeleteButton
                          action={deleteInvoice.bind(null, i.id, student.id)}
                          label="Delete"
                          description="Delete this invoice, its line items, and any linked payments. Cannot be undone."
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(invoices?.length ?? 0) === 0 && <tr><td colSpan={4} className="text-slate-500 text-sm py-4 text-center">No invoices</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="card p-0 overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b border-slate-200 font-medium">Recent payments</div>
          <table className="table">
            <thead><tr><th>Date</th><th className="text-right">Amount</th><th>Channel</th></tr></thead>
            <tbody>
              {(payments ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{shortDate(p.paid_at)}</td>
                  <td>{mmk(p.amount)}</td>
                  <td>{p.channel}</td>
                </tr>
              ))}
              {(payments?.length ?? 0) === 0 && <tr><td colSpan={3} className="text-slate-500 text-sm py-4 text-center">No payments</td></tr>}
            </tbody>
          </table>
        </section>
      </div>

      <div className="mt-6">
        <Link href="/students" className="text-sm text-slate-500 hover:text-slate-700">← Back to students</Link>
      </div>
    </div>
  );
}
