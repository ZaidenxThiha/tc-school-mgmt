import { type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
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

  const statusCond = status !== 'all' ? sql`and s.current_status = ${status}` : sql``;
  const qCond = q ? sql`and (s.english_name ilike ${'%' + q + '%'} or s.myanmar_name ilike ${'%' + q + '%'})` : sql``;

  const rows = (await sql`
    select s.id, s.english_name, s.myanmar_name, s.current_status,
           to_char(s.enrolled_at, 'YYYY-MM-DD') as enrolled_at,
           case when g.id is null then null else json_build_object('phone_primary', g.phone_primary) end as guardian
    from students s left join guardians g on g.id = s.guardian_id
    where true ${statusCond} ${qCond}
    order by s.id desc limit 5000
  `) as unknown as Row[];
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
