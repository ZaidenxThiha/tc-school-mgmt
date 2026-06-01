'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { mmk, shortDate } from '@/lib/format';
import PayInFullButton from '@/components/pay-in-full-button';
import DeleteButton from '@/components/delete-button';
import { deleteInvoice, voidInvoice, bulkInvoiceAction } from '@/lib/actions/invoice';

export type InvoiceRow = {
  id: number;
  billing_month: string | Date;
  total_amount: number;
  status: string;
  is_new_student: boolean | null;
  student: { id: number; english: string | null; myanmar: string | null } | null;
  sectionLabel: string;
};

const badgeFor = (s: string) =>
  s === 'paid' ? 'badge-green' : s === 'partial' ? 'badge-amber' : s === 'void' ? 'badge-slate' : 'badge-rose';

export default function BulkInvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();

  const allSelected = invoices.length > 0 && invoices.every((i) => selected.has(i.id));
  const toggle = (id: number) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(invoices.map((i) => i.id)));

  function runBulk(action: 'paid' | 'void' | 'delete') {
    const ids = [...selected];
    if (ids.length === 0) return;
    const verb = action === 'paid' ? 'mark paid (full cash payment)' : action;
    if (!confirm(`${verb.toUpperCase()} ${ids.length} selected invoice${ids.length === 1 ? '' : 's'}?`)) return;
    start(async () => { await bulkInvoiceAction(action, ids); setSelected(new Set()); });
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 mb-2 flex flex-wrap items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
          <span className="font-medium text-brand-800">{selected.size} selected</span>
          <button disabled={pending} onClick={() => runBulk('paid')} className="btn-ghost text-xs">Mark paid</button>
          <button disabled={pending} onClick={() => runBulk('void')} className="btn-ghost text-xs">Void</button>
          <button disabled={pending} onClick={() => runBulk('delete')} className="btn-ghost text-xs text-rose-700">Delete</button>
          <button disabled={pending} onClick={() => setSelected(new Set())} className="text-xs text-slate-500 hover:underline ml-1">Clear</button>
          {pending && <span className="text-xs text-slate-500">working…</span>}
        </div>
      )}
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th className="w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
              <th>#</th><th>Student</th><th>Section</th><th>Type</th>
              <th className="text-right">Amount</th><th>Status</th>
              <th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {invoices.map((inv) => {
                const payable = inv.status === 'open';
                return (
                  <tr key={inv.id} className={selected.has(inv.id) ? 'bg-brand-50/40' : ''}>
                    <td><input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} aria-label={`Select invoice ${inv.id}`} /></td>
                    <td className="text-slate-400">{inv.id}</td>
                    <td>
                      {inv.student ? (
                        <Link href={`/students/${inv.student.id}`} className="text-brand-600 hover:underline">
                          {inv.student.english ?? '—'}
                          {inv.student.myanmar && <div className="text-[11px] text-slate-500 font-normal">{inv.student.myanmar}</div>}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="text-xs">{inv.sectionLabel}</td>
                    <td><span className={inv.is_new_student ? 'badge-amber' : 'badge-slate'}>{inv.is_new_student ? 'New' : 'Old'}</span></td>
                    <td className="text-right tabular-nums">{mmk(inv.total_amount)}</td>
                    <td><span className={badgeFor(inv.status)}>{inv.status}</span></td>
                    <td className="text-right whitespace-nowrap">
                      {payable && <PayInFullButton invoiceId={inv.id} amountLabel={mmk(inv.total_amount)} />}
                      <Link href={`/billing/${inv.id}/receipt`} className="text-slate-600 hover:underline text-xs ml-3">Receipt</Link>
                      <Link href={`/billing/${inv.id}/edit`} className="text-brand-600 hover:underline text-xs ml-3">Edit</Link>
                      {inv.status !== 'void' && inv.status !== 'paid' && (
                        <button onClick={() => start(() => voidInvoice(inv.id))} disabled={pending} className="text-slate-500 hover:text-slate-700 text-xs ml-3">Void</button>
                      )}
                      <span className="ml-3 inline-block align-middle">
                        <DeleteButton
                          action={deleteInvoice.bind(null, inv.id, inv.student?.id ?? 0)}
                          label="Delete"
                          description="Delete this invoice, its line items, and any linked payments. Cannot be undone."
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr><td colSpan={8} className="text-slate-500 text-sm py-6 text-center">No invoices.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
