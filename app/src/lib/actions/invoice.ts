'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Delete an invoice (its invoice_lines cascade automatically). Blocked when the
// invoice has linked payments — those should be removed, or the invoice voided,
// to preserve the financial record.
export async function deleteInvoice(invoiceId: number, studentId: number) {
  const id = z.coerce.number().int().positive().parse(invoiceId);
  const supabase = await createClient();

  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_id', id);
  if (count && count > 0) {
    throw new Error('This invoice has linked payments — remove the payments or void it instead.');
  }

  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath(`/students/${studentId}`);
  revalidatePath('/billing');
}
