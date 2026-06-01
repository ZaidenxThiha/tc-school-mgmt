import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toCsv, csvResponse, type CsvColumn } from '@/lib/csv';

type Row = {
  id: number; paid_at: string; amount: number; channel: string; note: string | null;
  student: { english_name: string | null; myanmar_name: string | null } | null;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const month = sp.get('month') ?? '';
  const channel = sp.get('channel') ?? 'all';
  const q = sp.get('q') ?? '';

  const supabase = await createClient();
  let query = supabase
    .from('payments')
    .select('id, paid_at, amount, channel, note, student:students!inner(english_name, myanmar_name)')
    .order('paid_at', { ascending: false })
    .limit(10000);
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    query = query.gte('paid_at', new Date(Date.UTC(y, m - 1, 1)).toISOString())
                 .lt('paid_at', new Date(Date.UTC(y, m, 1)).toISOString());
  }
  if (channel !== 'all') query = query.eq('channel', channel);
  if (q) query = query.or(`english_name.ilike.%${q}%,myanmar_name.ilike.%${q}%`, { foreignTable: 'students' });

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  const columns: CsvColumn<Row>[] = [
    { key: 'id', label: 'Payment #', value: (r) => r.id },
    { key: 'date', label: 'Date', value: (r) => r.paid_at?.slice(0, 10) },
    { key: 'student', label: 'Student', value: (r) => r.student?.english_name ?? r.student?.myanmar_name ?? '' },
    { key: 'amount', label: 'Amount (MMK)', value: (r) => r.amount },
    { key: 'channel', label: 'Channel', value: (r) => r.channel },
    { key: 'note', label: 'Note', value: (r) => r.note ?? '' },
  ];

  return csvResponse(toCsv(rows, columns), `payments-${month || 'all'}.csv`);
}
