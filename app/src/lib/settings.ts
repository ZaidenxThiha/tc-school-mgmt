import { sql } from '@/lib/db';

// Typed access to the app_settings (key/value text) table. Used for the face
// attendance tunables (face.match_threshold, face.late_minutes, …) so they can be
// changed from the UI without a redeploy. Values are read fresh per request — the
// table is tiny and these reads are not hot.

export async function getSetting(key: string): Promise<string | null> {
  const rows = (await sql`select value from app_settings where key = ${key} limit 1`) as unknown as {
    value: string | null;
  }[];
  return rows[0]?.value ?? null;
}

export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const v = await getSetting(key);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql`
    insert into app_settings (key, value, updated_at) values (${key}, ${value}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

// The face-attendance config bundle, read in one round-trip.
export type FaceConfig = {
  matchThreshold: number; // cosine-similarity floor (0..1)
  lateMinutes: number; // minutes after start_time before a mark is 'Late'
  cooldownSeconds: number; // server-side per-person cooldown
  minFacePx: number; // smallest usable detected-face size
};

export async function getFaceConfig(): Promise<FaceConfig> {
  const rows = (await sql`
    select key, value from app_settings
    where key in ('face.match_threshold','face.late_minutes','face.cooldown_seconds','face.min_face_px')`) as unknown as {
    key: string;
    value: string | null;
  }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => {
    const n = Number(map.get(k));
    return Number.isFinite(n) ? n : d;
  };
  return {
    matchThreshold: num('face.match_threshold', 0.45),
    lateMinutes: num('face.late_minutes', 10),
    cooldownSeconds: num('face.cooldown_seconds', 45),
    minFacePx: num('face.min_face_px', 80),
  };
}
