'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireRole, WRITE_ADMIN } from '@/lib/auth-guard';

const CopyArgs = z.object({
  monthIso: z.string().regex(/^\d{4}-\d{2}-01$/, 'expected YYYY-MM-01'),
  overwrite: z.boolean(),
});

export async function copyFromPreviousMonth(monthIso: string, overwrite: boolean) {
  const args = CopyArgs.parse({ monthIso, overwrite });
  await requireRole(WRITE_ADMIN);
  const rows = await sql`select copied, to_char(source_month, 'YYYY-MM-DD') as source_month
    from copy_schedule_from_previous(${args.monthIso}, ${args.overwrite})`;
  const r = rows[0] as { copied: number; source_month: string | null } | undefined;
  revalidatePath('/schedule');
  redirect(`/schedule?month=${args.monthIso.slice(0, 7)}&copied=${r?.copied ?? 0}&from=${r?.source_month ?? ''}`);
}
