'use server';

import { z } from 'zod';
import { DELETABLE_TABLES } from '@/lib/deletable-tables';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_FINANCE } from '@/lib/auth-guard';

// Rows feeding the cached `reference` getters (lib/reference.ts).
const REFERENCE_TABLES = new Set(['sections', 'fee_schedule']);

const DeleteSchema = z.object({
  table: z.enum(DELETABLE_TABLES),
  id: z.union([z.number().int().positive(), z.string().min(1).max(64)]),
  redirectTo: z.string().startsWith('/').max(256).optional(),
});

export async function deleteRow(
  table: (typeof DELETABLE_TABLES)[number],
  id: number | string,
  redirectTo?: string,
) {
  const parsed = DeleteSchema.parse({ table, id, redirectTo });
  await requireRole(WRITE_FINANCE);
  // `table` is constrained to the allow-list enum, so it is safe to inline.
  await sql.unsafe(`delete from ${parsed.table} where id = $1`, [parsed.id]);

  if (REFERENCE_TABLES.has(parsed.table)) revalidateTag('reference');
  if (parsed.redirectTo) {
    revalidatePath(parsed.redirectTo);
    redirect(parsed.redirectTo);
  } else {
    revalidatePath('/');
  }
}
