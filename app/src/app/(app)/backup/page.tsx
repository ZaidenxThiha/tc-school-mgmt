import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import BackupActions from '@/components/backup-actions';
import BackupHistory from '@/components/backup-history';
import BackupSchedule from '@/components/backup-schedule';


export default async function BackupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = (user?.app_metadata?.role as string | undefined) ?? 'readonly';
  if (role !== 'owner') {
    return (
      <div className="page-narrow">
        <PageHeader title="Backup & Restore" />
        <div className="card text-sm text-rose-700">Owner role required.</div>
      </div>
    );
  }

  // Quick row count snapshot for context
  const tables = ['students','employees','payments','invoices','ledger_entries','schedule_assignments','employee_payslips'];
  const counts = await Promise.all(tables.map(async (t) => {
    const { count } = await supabase.from(t).select('id', { count: 'exact', head: true });
    return [t, count ?? 0] as const;
  }));

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
          <li>Every row from every public-schema table (~30 tables)</li>
          <li>JSON format with version, timestamp, total row count</li>
          <li>Includes seed data (levels, chart of accounts) — safe to restore as-is</li>
          <li>Excludes <code>auth.users</code> — user accounts must be recreated separately</li>
        </ul>
        <div className="font-medium text-slate-800 mt-3">Restore behaviour</div>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>Truncates every table</strong> first, then re-inserts from the file</li>
          <li>Triggers are paused during restore (faster, avoids cascading recompute)</li>
          <li>ID sequences are reset so future inserts continue cleanly</li>
          <li>Requires the password <code>admin123</code> to confirm</li>
        </ul>
      </div>
    </div>
  );
}
