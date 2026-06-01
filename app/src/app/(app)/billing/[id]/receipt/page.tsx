import { notFound } from 'next/navigation';
import Link from 'next/link';
import { sql } from '@/lib/db';
import { mmk, monthLabel, shortDate } from '@/lib/format';
import PrintButton from '@/components/print-button';
import { ArrowLeft } from 'lucide-react';


export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const [invRows, lines, payments] = await Promise.all([
    sql`select i.*,
          json_build_object('id', st.id, 'english_name', st.english_name, 'myanmar_name', st.myanmar_name,
            'guardian', case when g.id is null then null else json_build_object('phone_primary', g.phone_primary, 'viber_number', g.viber_number) end) as student,
          case when sec.id is null then null else json_build_object('time_slot', sec.time_slot, 'is_online', sec.is_online, 'level', json_build_object('name', l.name)) end as section
        from invoices i join students st on st.id = i.student_id
        left join guardians g on g.id = st.guardian_id
        left join sections sec on sec.id = i.section_id left join levels l on l.id = sec.level_id
        where i.id = ${id}`,
    sql`select * from invoice_lines where invoice_id = ${id} order by id`,
    sql`select id, paid_at, amount, channel from payments where invoice_id = ${id} order by paid_at`,
  ]);
  const inv = invRows[0] as unknown as {
    id: number; created_at: string | Date | null; billing_month: string | Date;
    total_amount: number; discount: number | null; fine: number | null; status: string; is_new_student: boolean | null;
    student: { id: number; english_name: string | null; myanmar_name: string | null; guardian: { phone_primary?: string; viber_number?: string } | null } | null;
    section: { time_slot: string; is_online: boolean; level: { name: string } | null } | null;
  } | undefined;
  if (!inv) notFound();
  const s = inv.student;
  const sec = inv.section;
  const paid = (payments as unknown as { amount: number }[]).reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
  const balance = Number(inv.total_amount ?? 0) - paid;

  return (
    <>
      <style>{`
        @media print {
          body, html { background: white !important; }
          .no-print { display: none !important; }
          .receipt-page { box-shadow: none !important; border: none !important; max-width: none !important; }
          @page { margin: 1cm; }
        }
      `}</style>
      <div className="bg-slate-100 min-h-screen py-6">
        <div className="no-print max-w-3xl mx-auto px-4 mb-4 flex items-center justify-between flex-wrap gap-2">
          <Link href="/billing" className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to billing
          </Link>
          <PrintButton />
        </div>

        <div className="receipt-page max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 p-6 sm:p-10">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Thazin &amp; Cherry</h1>
              <p className="text-xs text-slate-600">English Training Centre — Mandalay</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Receipt</div>
              <div className="text-sm font-mono">#{String(inv.id).padStart(6, '0')}</div>
              <div className="text-xs text-slate-500 mt-1">{shortDate(inv.created_at)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Billed to</div>
              <div className="font-semibold text-base">{s?.english_name ?? s?.myanmar_name ?? '—'}</div>
              {s?.myanmar_name && s?.english_name && (
                <div className="text-xs text-slate-600">{s.myanmar_name}</div>
              )}
              <div className="text-xs text-slate-600 mt-1">
                {s?.guardian?.phone_primary && <div>📞 {s.guardian.phone_primary}</div>}
                {s?.guardian?.viber_number && <div>📱 {s.guardian.viber_number}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">For</div>
              <div className="font-semibold">{monthLabel(inv.billing_month)}</div>
              <div className="text-xs text-slate-600 mt-1">
                {sec ? `${sec.level?.name ?? '?'} (${sec.time_slot})${sec.is_online ? ' · Online' : ''}` : '—'}
              </div>
              <div className="text-xs text-slate-600">
                {inv.is_new_student ? 'New student' : 'Returning student'}
              </div>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="text-left text-[10px] uppercase tracking-wide text-slate-500 font-medium py-2">Item</th>
                <th className="text-left text-[10px] uppercase tracking-wide text-slate-500 font-medium py-2">Description</th>
                <th className="text-right text-[10px] uppercase tracking-wide text-slate-500 font-medium py-2 w-16">Qty</th>
                <th className="text-right text-[10px] uppercase tracking-wide text-slate-500 font-medium py-2 w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(lines ?? []).map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-2 capitalize">{l.kind.replace('_', ' ')}</td>
                  <td className="py-2 text-slate-600 text-xs">{l.description ?? '—'}</td>
                  <td className="py-2 text-right tabular-nums">{l.qty ?? 1}</td>
                  <td className="py-2 text-right tabular-nums">{mmk(l.amount)}</td>
                </tr>
              ))}
              {(lines?.length ?? 0) === 0 && (
                <tr><td colSpan={4} className="py-2 text-slate-500">No itemised lines — total only.</td></tr>
              )}
            </tbody>
            <tfoot>
              {Number(inv.discount ?? 0) > 0 && (
                <tr className="border-t border-slate-300">
                  <td colSpan={3} className="text-right py-2 text-slate-600">Discount</td>
                  <td className="text-right py-2 tabular-nums text-emerald-700">−{mmk(inv.discount)}</td>
                </tr>
              )}
              {Number(inv.fine ?? 0) > 0 && (
                <tr>
                  <td colSpan={3} className="text-right py-2 text-slate-600">Fine</td>
                  <td className="text-right py-2 tabular-nums text-rose-700">+{mmk(inv.fine)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-900">
                <td colSpan={3} className="text-right py-2 font-semibold text-base">Total</td>
                <td className="text-right py-2 tabular-nums font-bold text-lg">{mmk(inv.total_amount)}</td>
              </tr>
              {paid > 0 && (
                <tr>
                  <td colSpan={3} className="text-right py-1 text-slate-600 text-xs">Paid</td>
                  <td className="text-right py-1 tabular-nums text-emerald-700">−{mmk(paid)}</td>
                </tr>
              )}
              {balance !== 0 && (
                <tr>
                  <td colSpan={3} className="text-right py-1 font-semibold">Balance</td>
                  <td className={`text-right py-1 tabular-nums font-semibold ${balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{mmk(balance)}</td>
                </tr>
              )}
            </tfoot>
          </table>

          {(payments?.length ?? 0) > 0 && (
            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Payments received</div>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {(payments ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600">{shortDate(p.paid_at)}</td>
                      <td className="py-1.5 capitalize">{p.channel}</td>
                      <td className="py-1.5 text-right tabular-nums">{mmk(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Status: <span className={`badge ${
                inv.status === 'paid' ? 'badge-green' :
                inv.status === 'partial' ? 'badge-amber' :
                inv.status === 'void' ? 'badge-slate' :
                'badge-rose'
              }`}>{inv.status}</span>
            </div>
            <div className="text-xs text-slate-500">Thank you for your payment.</div>
          </div>
        </div>
      </div>
    </>
  );
}
