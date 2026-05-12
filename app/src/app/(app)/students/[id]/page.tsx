import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { mmk, shortDate } from '@/lib/format';


export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const [{ data: student }, { data: enrolments }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.from('students').select('*, guardian:guardians(*)').eq('id', id).single(),
    supabase.from('enrolments').select('id, start_date, end_date, status, section:sections(time_slot, is_online, level:levels(name))').eq('student_id', id).order('start_date', { ascending: false }),
    supabase.from('invoices').select('id, billing_month, total_amount, status').eq('student_id', id).order('billing_month', { ascending: false }).limit(12),
    supabase.from('payments').select('id, paid_at, amount, channel').eq('student_id', id).order('paid_at', { ascending: false }).limit(12),
  ]);

  if (!student) notFound();
  const guardian = student.guardian as unknown as { full_name?: string; phone_primary?: string; phone_secondary?: string; viber_number?: string } | null;

  return (
    <div className="page">
      <PageHeader
        title={student.english_name ?? `Student #${student.id}`}
        subtitle={student.myanmar_name ?? '—'}
        actions={<Link href={`/students/${student.id}/edit`} className="btn-primary">Edit</Link>}
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
          <div className="text-xs uppercase text-slate-500 font-medium">Notes</div>
          <div className="mt-1 text-sm text-slate-600">{student.notes ?? '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-medium">Enrolment history</div>
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
          <div className="px-4 py-3 border-b border-slate-200 font-medium">Recent invoices</div>
          <table className="table">
            <thead><tr><th>Month</th><th className="text-right">Total</th><th>Status</th></tr></thead>
            <tbody>
              {(invoices ?? []).map((i) => (
                <tr key={i.id}>
                  <td>{shortDate(i.billing_month)}</td>
                  <td>{mmk(i.total_amount)}</td>
                  <td>{i.status}</td>
                </tr>
              ))}
              {(invoices?.length ?? 0) === 0 && <tr><td colSpan={3} className="text-slate-500 text-sm py-4 text-center">No invoices</td></tr>}
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
