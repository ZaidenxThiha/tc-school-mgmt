'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const CopyArgs = z.object({
  monthIso: z.string().regex(/^\d{4}-\d{2}-01$/, 'expected YYYY-MM-01'),
  overwrite: z.boolean(),
});

export async function copyFromPreviousMonth(monthIso: string, overwrite: boolean) {
  const args = CopyArgs.parse({ monthIso, overwrite });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('copy_schedule_from_previous', {
    target_month: args.monthIso,
    overwrite: args.overwrite,
  });
  if (error) throw new Error(error.message);
  const r = (data as { copied: number; source_month: string | null }[] | null)?.[0];
  revalidatePath('/schedule');
  redirect(
    `/schedule?month=${args.monthIso.slice(0, 7)}&copied=${r?.copied ?? 0}&from=${r?.source_month ?? ''}`,
  );
}
