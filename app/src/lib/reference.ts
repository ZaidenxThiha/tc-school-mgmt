import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { publicClient } from '@/lib/supabase/public';

// Reference data changes rarely and is read by many pages/forms.
//
// levels/sections/rooms: non-sensitive → cached CROSS-REQUEST via unstable_cache
//   over a cookieless anon client, tagged 'reference' (revalidate on edit, or
//   hourly as a backstop). One DB hit serves every request until invalidated.
// discount_types: contains amounts → kept on the per-request (React cache) authed
//   path so it stays behind RLS and is never exposed to anon.

export const getLevels = unstable_cache(
  async () => {
    const { data } = await publicClient
      .from('levels')
      .select('id, code, name, display_order')
      .order('display_order');
    return data ?? [];
  },
  ['ref-levels'],
  { tags: ['reference'], revalidate: 3600 },
);

export const getSections = unstable_cache(
  async () => {
    const { data } = await publicClient
      .from('sections')
      .select('id, time_slot, is_online, capacity, level_id, level:levels(name, code, display_order)')
      .order('id');
    return data ?? [];
  },
  ['ref-sections'],
  { tags: ['reference'], revalidate: 3600 },
);

export const getRooms = unstable_cache(
  async () => {
    const { data } = await publicClient
      .from('rooms')
      .select('id, name')
      .order('name');
    return data ?? [];
  },
  ['ref-rooms'],
  { tags: ['reference'], revalidate: 3600 },
);

// Sensitive (amounts) — per-request memoized, RLS-protected, not anon-exposed.
export const getDiscountTypes = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('discount_types')
    .select('id, code, name, kind, default_value, is_active')
    .order('id');
  return data ?? [];
});
