'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const Arg = z.object({ invoiceId: z.coerce.number().int().positive() });

// Record a single payment covering the invoice's full outstanding balance.
// The reconciliation trigger then flips the invoice to 'paid'.
export async function payInvoiceInFull(invoiceId: number) {
  const { invoiceId: id } = Arg.parse({ invoiceId });
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from('invoices')
    .select('id, student_id, total_amount, status, payments(amount)')
    .eq('id', id)
    .single();

  if (!inv || inv.status === 'void' || inv.status === 'paid') return;

  const paid = ((inv.payments as { amount: number }[] | null) ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstanding = Number(inv.total_amount) - paid;
  if (outstanding <= 0) return;

  const { error } = await supabase.from('payments').insert({
    student_id: inv.student_id,
    invoice_id: id,
    paid_at: new Date().toISOString(),
    amount: outstanding,
    channel: 'cash',
    note: 'Paid in full (quick action)',
  });
  if (error) throw new Error(error.message);

  revalidatePath('/billing');
  revalidatePath('/payments');
  revalidatePath(`/students/${inv.student_id}`);
}
