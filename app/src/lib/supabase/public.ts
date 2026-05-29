import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Cookieless, anon-key Supabase client for reading PUBLIC reference data
// (levels, sections, rooms) inside `unstable_cache`. It carries no user session,
// so it must only ever touch tables with an anon SELECT policy — never PII or
// financial tables.
export const publicClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
