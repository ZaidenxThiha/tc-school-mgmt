'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { DELETABLE_TABLES, type DeletableTable } from '@/lib/deletable-tables';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

// Tables whose rows feed the cached `reference` getters (lib/reference.ts).
const REFERENCE_TABLES = new Set(['sections', 'fee_schedule']);

const DeleteSchema = z.object({
  table: z.enum(DELETABLE_TABLES),
  id: z.union([z.number().int().positive(), z.string().min(1).max(64)]),
  redirectTo: z.string().startsWith('/').max(256).optional(),
});

export async function deleteRow(
  table: DeletableTable,
  id: number | string,
  redirectTo?: string,
) {
  const parsed = DeleteSchema.parse({ table, id, redirectTo });
  const supabase = await createClient();
  const { error } = await supabase.from(parsed.table).delete().eq('id', parsed.id);
  if (error) throw new Error(`Delete ${parsed.table}#${parsed.id}: ${error.message}`);
  if (REFERENCE_TABLES.has(parsed.table)) revalidateTag('reference');
  if (parsed.redirectTo) {
    revalidatePath(parsed.redirectTo);
    redirect(parsed.redirectTo);
  } else {
    revalidatePath('/');
  }
}
