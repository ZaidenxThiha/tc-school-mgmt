import Link from 'next/link';
import { sql } from '@/lib/db';
import { auth } from '@/auth';
import PageHeader from '@/components/page-header';
import { mmk, shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';
import { deleteRow } from '@/lib/actions';


export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string; role?: string } | undefined;
  const role = user?.role ?? '—';

  const [levels, prices, discounts] = await Promise.all([
    sql`select id, code, name, display_order from levels order by display_order`,
    sql`select fs.*,
          to_char(fs.effective_from, 'YYYY-MM-DD') as effective_from,
          to_char(fs.effective_to, 'YYYY-MM-DD') as effective_to,
          case when l.id is null then null else json_build_object('name', l.name) end as level
        from fee_schedule fs left join levels l on l.id = fs.level_id
        order by fs.effective_from desc`,
    sql`select id, code, name, kind, default_value from discount_types`,
  ]) as unknown as [
    { id: number; code: string; name: string; display_order: number }[],
    Array<{ id: number; effective_from: string; effective_to: string | null;
      class_fee: number; textbook_fee: number | null; tshirt_fee: number | null; id_card_fee: number | null;
      level: { name: string } | null }>,
    { id: number; code: string; name: string; kind: string; default_value: number | null }[],
  ];

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Settings" subtitle="Reference data + your account" />
      <section className="card">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="font-medium">Your account</div>
          {role === 'owner' && (
            <div className="flex gap-2">
              <Link href="/settings/audit" className="btn-ghost text-xs">Audit log →</Link>
              <Link href="/settings/users" className="btn-primary text-xs">Manage users →</Link>
            </div>
          )}
        </div>
        <dl className="text-sm grid grid-cols-2 gap-y-1 max-w-md">
          <dt className="text-slate-500">Email</dt><dd>{user?.email ?? '—'}</dd>
          <dt className="text-slate-500">Role</dt><dd><span className="badge-green">{role}</span></dd>
          <dt className="text-slate-500">User ID</dt><dd className="font-mono text-xs truncate">{user?.id ?? '—'}</dd>
        </dl>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-medium flex items-center justify-between">
          <span>Fee schedule ({prices.length})</span>
          <Link href="/settings/fees/new" className="btn-primary text-xs">+ Add fee row</Link>
        </div>
        <table className="table">
          <thead><tr><th>Level</th><th>From</th><th>To</th><th className="text-right">Class fee</th><th className="text-right">Textbook</th><th className="text-right">T-Shirt</th><th className="text-right">ID</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {prices.map((p) => {
              const del = deleteRow.bind(null, 'fee_schedule', p.id, '/settings');
              return (
                <tr key={p.id}>
                  <td>{p.level?.name ?? '—'}</td>
                  <td>{shortDate(p.effective_from)}</td>
                  <td>{p.effective_to ? shortDate(p.effective_to) : '∞'}</td>
                  <td className="tabular-nums">{mmk(p.class_fee)}</td>
                  <td className="tabular-nums">{mmk(p.textbook_fee)}</td>
                  <td className="tabular-nums">{mmk(p.tshirt_fee)}</td>
                  <td className="tabular-nums">{mmk(p.id_card_fee)}</td>
                  <td className="text-right">
                    <Link href={`/settings/fees/${p.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                    <DeleteButton action={del} />
                  </td>
                </tr>
              );
            })}
            {prices.length === 0 && (
              <tr><td colSpan={8} className="text-slate-500 text-sm py-6 text-center">No prices yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">Levels ({levels.length})</div>
        <table className="table">
          <thead><tr><th>#</th><th>Code</th><th>Name</th></tr></thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.id}><td className="text-slate-400">{l.display_order}</td><td className="font-mono text-xs">{l.code}</td><td>{l.name}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b font-medium">Discount types ({discounts.length})</div>
        <table className="table">
          <thead><tr><th>Code</th><th>Name</th><th>Kind</th><th className="text-right">Default</th></tr></thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id}>
                <td className="font-mono text-xs">{d.code}</td>
                <td>{d.name}</td>
                <td>{d.kind}</td>
                <td className="tabular-nums">{d.kind === 'percent' && d.default_value ? `${Number(d.default_value) / 100}%` : mmk(d.default_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
