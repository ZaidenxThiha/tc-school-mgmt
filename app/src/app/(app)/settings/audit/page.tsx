import { sql } from '@/lib/db';
import { auth } from '@/auth';
import PageHeader from '@/components/page-header';
import Pagination, { parsePage } from '@/components/pagination';

type Row = {
  id: number;
  table_name: string;
  row_id: string | null;
  action: string;
  changed_at: string;
  diff: Record<string, unknown> | null;
  actor_email: string | null;
  full_count: number;
};

const ACTION_BADGE: Record<string, string> = {
  login: 'badge-green',
  login_failed: 'badge-amber',
  login_blocked: 'badge-amber',
  user_create: 'badge-green',
  user_update: 'badge-slate',
  user_delete: 'badge-amber',
  user_password_reset: 'badge-amber',
  backup_create: 'badge-slate',
  backup_delete: 'badge-amber',
  backup_restore: 'badge-amber',
  backup_restore_file: 'badge-amber',
  backup_schedule_set: 'badge-slate',
};

export default async function AuditPage({
  searchParams,
}: { searchParams: Promise<{ action?: string; page?: string; pageSize?: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (role !== 'owner') {
    return (
      <div className="page-narrow">
        <PageHeader title="Audit log" />
        <div className="card text-sm text-rose-700">Owner role required.</div>
      </div>
    );
  }

  const sp = await searchParams;
  const action = sp.action ?? 'all';
  const { page, pageSize, from } = parsePage(sp, 50);
  const actionCond = action !== 'all' ? sql`where a.action = ${action}` : sql``;

  const [rows, actionsList] = await Promise.all([
    sql`
      select a.id, a.table_name, a.row_id, a.action,
             to_char(a.changed_at, 'YYYY-MM-DD HH24:MI') as changed_at,
             a.diff, u.email as actor_email,
             count(*) over()::int as full_count
      from audit_log a
      left join users u on u.id = a.changed_by
      ${actionCond}
      order by a.changed_at desc
      limit ${pageSize} offset ${from}` as unknown as Promise<Row[]>,
    sql`select distinct action from audit_log order by action` as unknown as Promise<{ action: string }[]>,
  ]);

  const total = rows[0]?.full_count ?? 0;

  return (
    <div className="page">
      <PageHeader title="Audit log" subtitle={`${total.toLocaleString()} security events · owner-only`} />

      <form className="flex gap-2 mb-3 flex-wrap">
        <select name="action" defaultValue={action} className="input max-w-[220px]">
          <option value="all">All actions</option>
          {actionsList.map((a) => <option key={a.action} value={a.action}>{a.action}</option>)}
        </select>
        <button className="btn-ghost">Filter</button>
        {action !== 'all' && <a href="/settings/audit" className="btn-ghost">Clear</a>}
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>When (UTC)</th><th>Actor</th><th>Action</th><th>Table</th><th>Row</th><th>Details</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs whitespace-nowrap tabular-nums">{r.changed_at}</td>
                  <td className="text-xs">{r.actor_email ?? <span className="text-slate-400">—</span>}</td>
                  <td><span className={ACTION_BADGE[r.action] ?? 'badge-slate'}>{r.action}</span></td>
                  <td className="text-xs">{r.table_name}</td>
                  <td className="text-xs font-mono text-slate-500 max-w-[140px] truncate" title={r.row_id ?? ''}>{r.row_id ?? '—'}</td>
                  <td className="text-xs text-slate-500 max-w-[260px] truncate" title={r.diff ? JSON.stringify(r.diff) : ''}>
                    {r.diff ? JSON.stringify(r.diff) : '—'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-slate-500 text-sm py-6 text-center">No audit events{action !== 'all' ? ' for this action' : ' yet'}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} basePath="/settings/audit" query={{ action }} />
      </div>
    </div>
  );
}
