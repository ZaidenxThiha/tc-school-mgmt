'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';

const Arg = z.object({ invoiceId: z.coerce.number().int().positive() });

// Record a single payment covering the invoice's full outstanding balance.
// The reconciliation trigger then flips the invoice to 'paid'.
export async function payInvoiceInFull(invoiceId: number) {
  const { invoiceId: id } = Arg.parse({ invoiceId });
  await requireRole(WRITE_FINANCE);

  const rows = await sql`
    select i.student_id, i.total_amount, i.status, coalesce(sum(p.amount), 0)::bigint as paid
    from invoices i left join payments p on p.invoice_id = i.id
    where i.id = ${id}
    group by i.id, i.student_id, i.total_amount, i.status`;
  const inv = rows[0];
  if (!inv || inv.status === 'void' || inv.status === 'paid') return;

  const outstanding = Number(inv.total_amount) - Number(inv.paid);
  if (outstanding <= 0) return;

  await sql`
    insert into payments (student_id, invoice_id, paid_at, amount, channel, note)
    values (${inv.student_id}, ${id}, now(), ${outstanding}, 'cash', 'Paid in full (quick action)')`;

  revalidatePath('/billing');
  revalidatePath('/payments');
  revalidatePath(`/students/${inv.student_id}`);
}
