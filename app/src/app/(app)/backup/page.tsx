import { sql } from '@/lib/db';
import { auth } from '@/auth';
import PageHeader from '@/components/page-header';
import BackupActions from '@/components/backup-actions';
import BackupHistory from '@/components/backup-history';
import BackupSchedule from '@/components/backup-schedule';


export default async function BackupPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'readonly';
  if (role !== 'owner') {
    return (
      <div className="page-narrow">
        <PageHeader title="Backup & Restore" />
        <div className="card text-sm text-rose-700">Owner role required.</div>
      </div>
    );
  }

  // Quick row count snapshot for context.
  const tables = ['students', 'employees', 'payments', 'invoices', 'ledger_entries', 'schedule_assignments', 'employee_payslips'];
  const rows = (await sql.unsafe(
    tables.map((t, i) => `select '${t}' as t, count(*)::int as n from ${t}${i < tables.length - 1 ? ' union all ' : ''}`).join('')
  )) as unknown as { t: string; n: number }[];
  const counts = tables.map((t) => [t, rows.find((r) => r.t === t)?.n ?? 0] as const);

  return (
    <div className="page max-w-3xl">
      <PageHeader title="Backup & Restore" subtitle="Owner-only · downloads/uploads complete database" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {counts.map(([t, n]) => (
          <div key={t} className="bg-white border border-slate-200 rounded-md px-3 py-2">
            <div className="text-[10px] uppercase text-slate-500 tracking-wide">{t}</div>
            <div className="text-sm font-semibold tabular-nums leading-tight mt-0.5">{n.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <BackupSchedule />
      </div>

      <BackupActions />

      <div className="mt-4">
        <BackupHistory />
      </div>

      <div className="card mt-4 text-xs text-slate-600 space-y-2">
        <div className="font-medium text-slate-800">What's in a backup file</div>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Every row from every data table (~30 tables)</li>
          <li>JSON format with version, timestamp, total row count</li>
          <li>Includes seed data (levels, chart of accounts) — safe to restore as-is</li>
          <li>Excludes the <code>users</code> (login) table — accounts are managed separately</li>
        </ul>
        <div className="font-medium text-slate-800 mt-3">Restore behaviour</div>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>Truncates every data table</strong> first, then re-inserts from the file</li>
          <li>Business triggers are paused during restore (faster, avoids cascading recompute)</li>
          <li>Foreign keys are deferred and validated once at the end</li>
          <li>ID sequences are reset so future inserts continue cleanly</li>
          <li>Requires re-entering <strong>your own account password</strong> to confirm</li>
        </ul>
      </div>
    </div>
  );
}
