import Link from 'next/link';
import { sql } from '@/lib/db';
import PageHeader from '@/components/page-header';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';
import { mmk } from '@/lib/format';
import Pagination, { parsePage } from '@/components/pagination';

type Row = {
  id: number; short_name: string; full_name: string; category: string; phone: string | null;
  mt_hourly_fee: number | null; ct_hourly_fee: number | null; monthly_salary: number | null;
  is_active: boolean; full_count: number;
};


const CATEGORY_LABEL: Record<string, string> = {
  esl_teacher:'ESL Teacher', admin_teacher:'Admin Teacher', admin_staff:'Admin Staff',
  helper:'Helper', security:'Security', cleaner:'Cleaner', driver:'Driver',
  accountant:'Accountant', owner:'Owner', other:'Other',
};
const CATEGORY_BADGE: Record<string, string> = {
  esl_teacher:'badge-green', admin_teacher:'badge-green', admin_staff:'badge-amber',
  helper:'badge-slate', security:'badge-slate', cleaner:'badge-slate', driver:'badge-slate',
  accountant:'badge-amber', owner:'badge-amber', other:'badge-slate',
};

export default async function EmployeesPage({
  searchParams,
}: { searchParams: Promise<{ category?: string; status?: string; q?: string; page?: string; pageSize?: string }> }) {
  const sp = await searchParams;
  const category = sp.category ?? 'all';
  const status   = sp.status   ?? 'active';
  const q        = (sp.q ?? '').trim();
  const { page, pageSize, from } = parsePage(sp, 50);

  const catCond = category !== 'all' ? sql`and category = ${category}` : sql``;
  const statusCond = status === 'active' ? sql`and is_active = true` : status === 'inactive' ? sql`and is_active = false` : sql``;
  const t = '%' + q + '%';
  const searchCond = q ? sql`and (short_name ilike ${t} or full_name ilike ${t} or phone ilike ${t} or email ilike ${t})` : sql``;

  const employees = (await sql`
    select id, short_name, full_name, category, phone, mt_hourly_fee, ct_hourly_fee, monthly_salary, is_active,
           count(*) over()::int as full_count
    from employees
    where true ${catCond} ${statusCond} ${searchCond}
    order by category, short_name
    limit ${pageSize} offset ${from}
  `) as unknown as Row[];
  const count = employees[0]?.full_count ?? 0;

  return (
    <div className="page">
      <PageHeader
        title="Employees"
        subtitle={`${count.toLocaleString('en-US')} matching · ${category === 'all' ? 'all categories' : CATEGORY_LABEL[category] ?? category}`}
        actions={<Link href="/employees/new" className="btn-primary">+ Add employee</Link>}
      />

      <form className="flex gap-2 mb-4 flex-wrap">
        <input name="q" defaultValue={q} placeholder="Search name / phone / email…" className="input max-w-sm" />
        <select name="category" defaultValue={category} className="input max-w-[200px]">
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="status" defaultValue={status} className="input max-w-[160px]">
          <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
        </select>
        <button className="btn-ghost">Filter</button>
        {(q || category !== 'all' || status !== 'active') && <a href="/employees" className="btn-ghost">Clear</a>}
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>#</th><th>Name</th><th>Category</th><th>Phone</th>
              <th className="text-right">Hourly fee (MMK)</th><th className="text-right">Salary</th><th>Status</th>
              <th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {employees.length === 0 && (
                <tr><td colSpan={8} className="text-slate-500 text-sm py-6 text-center">No employees in this filter.</td></tr>
              )}
              {employees.map((e) => {
                const del = deleteRow.bind(null, 'employees', e.id, '/employees');
                return (
                  <tr key={e.id}>
                    <td className="text-slate-400">{e.id}</td>
                    <td className="font-medium">
                      <Link href={`/employees/${e.id}`} className="text-brand-600 hover:underline">{e.short_name}</Link>
                      <br/><span className="text-xs text-slate-500">{e.full_name}</span>
                    </td>
                    <td><span className={CATEGORY_BADGE[e.category] ?? 'badge-slate'}>{CATEGORY_LABEL[e.category] ?? e.category}</span></td>
                    <td className="text-xs">{e.phone ?? '—'}</td>
                    <td className="text-xs tabular-nums">
                      {e.mt_hourly_fee || e.ct_hourly_fee ? (
                        <>
                          <span className="text-emerald-700">MT {e.mt_hourly_fee ? mmk(e.mt_hourly_fee) : '—'}</span>
                          <br/>
                          <span className="text-amber-700">CT {e.ct_hourly_fee ? mmk(e.ct_hourly_fee) : '—'}</span>
                        </>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="tabular-nums">{mmk(e.monthly_salary)}</td>
                    <td>{e.is_active ? <span className="badge-green">Active</span> : <span className="badge-slate">Inactive</span>}</td>
                    <td className="text-right">
                      <Link href={`/employees/${e.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <DeleteButton action={del} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={count} basePath="/employees" query={{ q, category, status }} />
      </div>
    </div>
  );
}
