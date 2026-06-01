'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';

// Mark a single invoice void.
export async function voidInvoice(invoiceId: number) {
  const id = z.coerce.number().int().positive().parse(invoiceId);
  await requireRole(WRITE_FINANCE);
  await sql`update invoices set status = 'void' where id = ${id} and status <> 'paid'`;
  revalidatePath('/billing');
}

// Bulk action over selected invoices: mark paid (full payment each), void, or delete.
export async function bulkInvoiceAction(action: 'paid' | 'void' | 'delete', ids: number[]) {
  const clean = z.array(z.coerce.number().int().positive()).parse(ids);
  if (clean.length === 0) return;
  await requireRole(WRITE_FINANCE);

  if (action === 'void') {
    await sql`update invoices set status = 'void' where id in ${sql(clean)} and status <> 'paid'`;
  } else if (action === 'delete') {
    await sql`delete from payments where invoice_id in ${sql(clean)}`;
    await sql`delete from invoices where id in ${sql(clean)}`;
    revalidatePath('/payments');
  } else if (action === 'paid') {
    const rows = await sql`
      select i.id, i.student_id, i.total_amount, i.status, coalesce(sum(p.amount), 0)::bigint as paid
      from invoices i left join payments p on p.invoice_id = i.id
      where i.id in ${sql(clean)}
      group by i.id, i.student_id, i.total_amount, i.status`;
    const ins = [];
    for (const inv of rows) {
      if (inv.status === 'void' || inv.status === 'paid') continue;
      const outstanding = Number(inv.total_amount) - Number(inv.paid);
      if (outstanding > 0) ins.push({ student_id: inv.student_id, invoice_id: inv.id, paid_at: new Date(), amount: outstanding, channel: 'cash', note: 'Bulk paid in full' });
    }
    if (ins.length) await sql`insert into payments ${sql(ins)}`;
    revalidatePath('/payments');
  }
  revalidatePath('/billing');
}

// Delete an invoice along with its linked payments (the payments FK is
// "no action", so they go first) and its line items (those cascade). Irreversible.
export async function deleteInvoice(invoiceId: number, studentId: number) {
  const id = z.coerce.number().int().positive().parse(invoiceId);
  await requireRole(WRITE_FINANCE);
  await sql`delete from payments where invoice_id = ${id}`;
  await sql`delete from invoices where id = ${id}`;
  revalidatePath(`/students/${studentId}`);
  revalidatePath('/billing');
  revalidatePath('/payments');
}
