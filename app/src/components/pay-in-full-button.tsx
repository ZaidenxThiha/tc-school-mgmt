'use client';

import { useState, useTransition } from 'react';
import { payInvoiceInFull } from '@/lib/actions/payment';

// One-click "mark paid": records a full-amount payment for the invoice after a
// lightweight confirm. The reconciliation trigger flips it to paid.
export default function PayInFullButton({ invoiceId, amountLabel }: { invoiceId: number; amountLabel?: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function onClick() {
    if (done || pending) return;
    if (!confirm(`Record a full payment${amountLabel ? ` of ${amountLabel}` : ''} (cash) for this invoice?`)) return;
    start(async () => {
      await payInvoiceInFull(invoiceId);
      setDone(true);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || done}
      className="text-emerald-700 hover:underline text-xs disabled:opacity-50"
    >
      {pending ? 'Paying…' : done ? '✓ Paid' : 'Mark paid'}
    </button>
  );
}
