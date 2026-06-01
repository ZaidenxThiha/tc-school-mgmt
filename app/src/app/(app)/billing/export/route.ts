import { type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { toCsv, csvResponse, type CsvColumn } from '@/lib/csv';

type Row = {
  id: number; billing_month: string; total_amount: number; discount: number | null; fine: number | null;
  status: string; is_new_student: boolean | null; english_name: string | null; myanmar_name: string | null;
  level_name: string | null; time_slot: string; is_online: boolean;
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = sp.get('month') && /^\d{4}-\d{2}$/.test(sp.get('month')!) ? sp.get('month')! : defaultMonth;
  const status = sp.get('status') ?? 'all';
  const section = sp.get('section') ?? 'all';
  const level = sp.get('level') ?? 'all';
  const q = (sp.get('q') ?? '').trim();

  const statusCond = status !== 'all' ? sql`and i.status = ${status}` : sql``;
  const sectionCond = section !== 'all' ? sql`and i.section_id = ${Number(section)}` : sql``;
  const levelCond = level !== 'all' ? sql`and sec.level_id = ${Number(level)}` : sql``;
  const searchCond = q ? sql`and (st.english_name ilike ${'%' + q + '%'} or st.myanmar_name ilike ${'%' + q + '%'})` : sql``;

  const rows = (await sql`
    select i.id, to_char(i.billing_month, 'YYYY-MM-DD') as billing_month, i.total_amount, i.discount, i.fine,
           i.status, i.is_new_student, st.english_name, st.myanmar_name, l.name as level_name, sec.time_slot, sec.is_online
    from invoices i
    join students st on st.id = i.student_id
    join sections sec on sec.id = i.section_id
    join levels l on l.id = sec.level_id
    where i.billing_month = ${`${month}-01`} ${statusCond} ${sectionCond} ${levelCond} ${searchCond}
    order by i.id desc limit 5000`) as unknown as Row[];

  const columns: CsvColumn<Row>[] = [
    { key: 'id', label: 'Invoice #', value: (r) => r.id },
    { key: 'month', label: 'Billing month', value: (r) => r.billing_month },
    { key: 'student', label: 'Student', value: (r) => r.english_name ?? r.myanmar_name ?? '' },
    { key: 'myanmar', label: 'Myanmar name', value: (r) => r.myanmar_name ?? '' },
    { key: 'level', label: 'Level', value: (r) => r.level_name ?? '' },
    { key: 'time_slot', label: 'Time slot', value: (r) => r.time_slot ?? '' },
    { key: 'mode', label: 'Mode', value: (r) => (r.is_online ? 'Online' : 'In-person') },
    { key: 'type', label: 'Type', value: (r) => (r.is_new_student ? 'New' : 'Old') },
    { key: 'discount', label: 'Discount', value: (r) => r.discount ?? 0 },
    { key: 'fine', label: 'Fine', value: (r) => r.fine ?? 0 },
    { key: 'total', label: 'Total (MMK)', value: (r) => r.total_amount },
    { key: 'status', label: 'Status', value: (r) => r.status },
  ];
  return csvResponse(toCsv(rows, columns), `invoices-${month}.csv`);
}
