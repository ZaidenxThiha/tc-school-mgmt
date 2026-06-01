import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toCsv, csvResponse, type CsvColumn } from '@/lib/csv';

type Row = {
  id: number; billing_month: string; total_amount: number; discount: number | null;
  fine: number | null; status: string; is_new_student: boolean | null;
  student: { english_name: string | null; myanmar_name: string | null } | null;
  section: { time_slot: string; is_online: boolean; level_id: number; level: { name: string } | null } | null;
};

// CSV export of the billing invoice list, honoring the same filters as the page.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = sp.get('month') && /^\d{4}-\d{2}$/.test(sp.get('month')!) ? sp.get('month')! : defaultMonth;
  const status = sp.get('status') ?? 'all';
  const section = sp.get('section') ?? 'all';
  const level = sp.get('level') ?? 'all';
  const q = sp.get('q') ?? '';

  const supabase = await createClient();
  let query = supabase
    .from('invoices')
    .select(`
      id, billing_month, total_amount, discount, fine, status, is_new_student,
      student:students!inner(english_name, myanmar_name),
      section:sections!inner(time_slot, is_online, level_id, level:levels(name))
    `)
    .eq('billing_month', `${month}-01`)
    .order('id', { ascending: false })
    .limit(5000);
  if (status !== 'all') query = query.eq('status', status);
  if (section !== 'all') query = query.eq('section_id', Number(section));
  if (level !== 'all') query = query.eq('sections.level_id', Number(level));
  if (q) query = query.or(`english_name.ilike.%${q}%,myanmar_name.ilike.%${q}%`, { foreignTable: 'students' });

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];
  const columns: CsvColumn<Row>[] = [
    { key: 'id', label: 'Invoice #', value: (r) => r.id },
    { key: 'month', label: 'Billing month', value: (r) => r.billing_month },
    { key: 'student', label: 'Student', value: (r) => r.student?.english_name ?? r.student?.myanmar_name ?? '' },
    { key: 'myanmar', label: 'Myanmar name', value: (r) => r.student?.myanmar_name ?? '' },
    { key: 'level', label: 'Level', value: (r) => r.section?.level?.name ?? '' },
    { key: 'time_slot', label: 'Time slot', value: (r) => r.section?.time_slot ?? '' },
    { key: 'mode', label: 'Mode', value: (r) => (r.section?.is_online ? 'Online' : 'In-person') },
    { key: 'type', label: 'Type', value: (r) => (r.is_new_student ? 'New' : 'Old') },
    { key: 'discount', label: 'Discount', value: (r) => r.discount ?? 0 },
    { key: 'fine', label: 'Fine', value: (r) => r.fine ?? 0 },
    { key: 'total', label: 'Total (MMK)', value: (r) => r.total_amount },
    { key: 'status', label: 'Status', value: (r) => r.status },
  ];

  return csvResponse(toCsv(rows, columns), `invoices-${month}.csv`);
}
