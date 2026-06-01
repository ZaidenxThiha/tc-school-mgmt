import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toCsv, csvResponse, type CsvColumn } from '@/lib/csv';

type Row = {
  id: number; english_name: string | null; myanmar_name: string | null;
  current_status: string; enrolled_at: string | null;
  guardian: { phone_primary: string | null } | null;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') ?? 'Active';
  const q = sp.get('q') ?? '';

  const supabase = await createClient();
  let query = supabase
    .from('students')
    .select('id, english_name, myanmar_name, current_status, enrolled_at, guardian:guardians(phone_primary)')
    .order('id', { ascending: false })
    .limit(5000);
  if (status !== 'all') query = query.eq('current_status', status);
  if (q) query = query.or(`english_name.ilike.%${q}%,myanmar_name.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  const columns: CsvColumn<Row>[] = [
    { key: 'id', label: 'ID', value: (r) => r.id },
    { key: 'english', label: 'English name', value: (r) => r.english_name ?? '' },
    { key: 'myanmar', label: 'Myanmar name', value: (r) => r.myanmar_name ?? '' },
    { key: 'phone', label: 'Guardian phone', value: (r) => r.guardian?.phone_primary ?? '' },
    { key: 'status', label: 'Status', value: (r) => r.current_status },
    { key: 'enrolled', label: 'Enrolled at', value: (r) => r.enrolled_at ?? '' },
  ];

  return csvResponse(toCsv(rows, columns), `students-${status}.csv`);
}
