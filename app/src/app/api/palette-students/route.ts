import { sql } from '@/lib/db';

// Minimal student list for the Cmd-K palette. Gated by the NextAuth middleware.
export async function GET() {
  const rows = await sql`select id, english_name, myanmar_name from students order by english_name limit 2000`;
  const students = (rows as unknown as { id: number; english_name: string | null; myanmar_name: string | null }[])
    .map((s) => ({ id: s.id, name: s.english_name ?? s.myanmar_name ?? `#${s.id}` }));
  return Response.json(students);
}
