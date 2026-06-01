import { type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { toCsv, csvResponse, type CsvColumn } from '@/lib/csv';

type Row = { id: number; paid_date: string; amount: number; channel: string; note: string | null; english_name: string | null; myanmar_name: string | null };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const month = sp.get('month') ?? '';
  const channel = sp.get('channel') ?? 'all';
  const q = (sp.get('q') ?? '').trim();

  let monthCond = sql``;
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    monthCond = sql`and p.paid_at >= ${new Date(Date.UTC(y, m - 1, 1)).toISOString()} and p.paid_at < ${new Date(Date.UTC(y, m, 1)).toISOString()}`;
  }
  const channelCond = channel !== 'all' ? sql`and p.channel = ${channel}` : sql``;
  const searchCond = q ? sql`and (st.english_name ilike ${'%' + q + '%'} or st.myanmar_name ilike ${'%' + q + '%'})` : sql``;

  const rows = (await sql`
    select p.id, to_char(p.paid_at,'YYYY-MM-DD') as paid_date, p.amount, p.channel, p.note,
           st.english_name, st.myanmar_name
    from payments p join students st on st.id = p.student_id
    where true ${monthCond} ${channelCond} ${searchCond}
    order by p.paid_at desc limit 10000`) as unknown as Row[];

  const columns: CsvColumn<Row>[] = [
    { key: 'id', label: 'Payment #', value: (r) => r.id },
    { key: 'date', label: 'Date', value: (r) => r.paid_date },
    { key: 'student', label: 'Student', value: (r) => r.english_name ?? r.myanmar_name ?? '' },
    { key: 'amount', label: 'Amount (MMK)', value: (r) => r.amount },
    { key: 'channel', label: 'Channel', value: (r) => r.channel },
    { key: 'note', label: 'Note', value: (r) => r.note ?? '' },
  ];
  return csvResponse(toCsv(rows, columns), `payments-${month || 'all'}.csv`);
}
