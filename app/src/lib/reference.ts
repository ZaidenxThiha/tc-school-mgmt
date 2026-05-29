import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// Reference data (levels, sections, rooms, discount types) changes rarely and is
// read by many pages/forms. These getters are memoized per request with React
// `cache()` so repeated reads in a single render hit the DB once, and they give
// one canonical query shape per table.
//
// NOTE: cross-request caching (unstable_cache) is intentionally deferred — these
// reads go through the cookie-bound, RLS-aware client, which can't be cached
// across requests safely. When a public-read/service path exists, swapping these
// bodies to unstable_cache is a single-file change.

export const getLevels = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('levels')
    .select('id, code, name, display_order')
    .order('display_order');
  return data ?? [];
});

export const getSections = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sections')
    .select('id, time_slot, is_online, capacity, level_id, level:levels(name, code, display_order)')
    .order('id');
  return data ?? [];
});

export const getRooms = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('rooms')
    .select('id, name')
    .order('name');
  return data ?? [];
});

export const getDiscountTypes = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('discount_types')
    .select('id, code, name, kind, default_value, is_active')
    .order('id');
  return data ?? [];
});
