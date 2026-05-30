'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
