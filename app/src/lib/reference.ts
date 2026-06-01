import { unstable_cache } from 'next/cache';
import { sql } from '@/lib/db';

// Reference data — cached cross-request (tag: 'reference'). Embedded relations
// are returned as JSON objects via json_build_object to match the shapes the
// pages already consume.

export const getLevels = unstable_cache(
  async () => sql`select id, code, name, display_order from levels order by display_order`,
  ['ref-levels'], { tags: ['reference'], revalidate: 3600 },
);

export const getSections = unstable_cache(
  async () => sql`
    select s.id, s.time_slot, s.is_online, s.capacity, s.level_id,
           json_build_object('name', l.name, 'code', l.code, 'display_order', l.display_order) as level
    from sections s join levels l on l.id = s.level_id
    order by s.id`,
  ['ref-sections'], { tags: ['reference'], revalidate: 3600 },
);

export const getRooms = unstable_cache(
  async () => sql`select id, name from rooms order by name`,
  ['ref-rooms'], { tags: ['reference'], revalidate: 3600 },
);

export const getDiscountTypes = unstable_cache(
  async () => sql`select id, code, name, kind, default_value, is_active from discount_types order by id`,
  ['ref-discount-types'], { tags: ['reference'], revalidate: 3600 },
);
