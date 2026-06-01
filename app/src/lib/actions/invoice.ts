'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Mark a single invoice void.
export async function voidInvoice(invoiceId: number) {
  const id = z.coerce.number().int().positive().parse(invoiceId);
  const supabase = await createClient();
  const { error } = await supabase.from('invoices').update({ status: 'void' }).eq('id', id).neq('status', 'paid');
  if (error) throw new Error(error.message);
  revalidatePath('/billing');
}

// Bulk action over selected invoices: mark paid (full payment each), void, or delete.
export async function bulkInvoiceAction(action: 'paid' | 'void' | 'delete', ids: number[]) {
  const clean = z.array(z.coerce.number().int().positive()).parse(ids);
  if (clean.length === 0) return;
  const supabase = await createClient();

  if (action === 'void') {
    const { error } = await supabase.from('invoices').update({ status: 'void' }).in('id', clean).neq('status', 'paid');
    if (error) throw new Error(error.message);
  } else if (action === 'delete') {
    const { error: payErr } = await supabase.from('payments').delete().in('invoice_id', clean);
    if (payErr) throw new Error(payErr.message);
    const { error } = await supabase.from('invoices').delete().in('id', clean);
    if (error) throw new Error(error.message);
    revalidatePath('/payments');
  } else if (action === 'paid') {
    const { data } = await supabase
      .from('invoices')
      .select('id, student_id, total_amount, status, payments(amount)')
      .in('id', clean);
    type Inv = { id: number; student_id: number; total_amount: number; status: string; payments: { amount: number }[] | null };
    const rows: { student_id: number; invoice_id: number; paid_at: string; amount: number; channel: string; note: string }[] = [];
    for (const inv of (data ?? []) as Inv[]) {
      if (inv.status === 'void' || inv.status === 'paid') continue;
      const paid = (inv.payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
      const outstanding = Number(inv.total_amount) - paid;
      if (outstanding > 0) {
        rows.push({ student_id: inv.student_id, invoice_id: inv.id, paid_at: new Date().toISOString(), amount: outstanding, channel: 'cash', note: 'Bulk paid in full' });
      }
    }
    if (rows.length) {
      const { error } = await supabase.from('payments').insert(rows); // trigger flips each to paid
      if (error) throw new Error(error.message);
    }
    revalidatePath('/payments');
  }
  revalidatePath('/billing');
}

// Delete an invoice along with its linked payments (the payments FK is
// "no action", so they must go first) and its line items (those cascade).
// Used to correct mistaken invoices, including paid ones. Irreversible.
export async function deleteInvoice(invoiceId: number, studentId: number) {
  const id = z.coerce.number().int().positive().parse(invoiceId);
  const supabase = await createClient();

  // Remove linked payments first so the invoice's FK references are clear.
  const { error: payErr } = await supabase.from('payments').delete().eq('invoice_id', id);
  if (payErr) throw new Error(payErr.message);

  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath(`/students/${studentId}`);
  revalidatePath('/billing');
  revalidatePath('/payments');
}
