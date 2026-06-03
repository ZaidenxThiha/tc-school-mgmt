import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { requireRole } from '@/lib/auth-guard';
import { audit } from '@/lib/audit';
import PageHeader from '@/components/page-header';
import { shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';


const OWNER = ['owner'] as const;

const ROLE_BADGE: Record<string, string> = {
  owner: 'badge-amber',
  admin: 'badge-green',
  accounts: 'badge-slate',
  readonly: 'badge-slate',
};

async function deleteUser(targetId: string) {
  'use server';
  await requireRole(OWNER);
  const session = await auth();
  const myId = (session?.user as { id?: string } | undefined)?.id;
  if (targetId === myId) throw new Error('You cannot delete your own account.');
  await sql`delete from users where id = ${targetId}`;
  await audit({ table: 'users', action: 'user_delete', rowId: targetId });
  revalidatePath('/settings/users');
}

export default async function UsersPage() {
  const session = await auth();
  const me = session?.user as { id?: string; role?: string } | undefined;
  const myRole = me?.role ?? '';
  if (myRole !== 'owner') {
    return (
      <div className="page-narrow">
        <PageHeader title="Users" />
        <div className="card text-sm text-rose-700">
          Owner role required. Your role: <span className="font-mono">{myRole || '—'}</span>
        </div>
      </div>
    );
  }

  const users = (await sql`
    select id, email, full_name, role, to_char(created_at, 'YYYY-MM-DD') as created_at
    from users order by created_at`) as unknown as
    { id: string; email: string; full_name: string | null; role: string; created_at: string }[];

  return (
    <div className="page">
      <PageHeader
        title="Users"
        subtitle={`${users.length} accounts · owner-only management`}
        actions={<Link href="/settings/users/new" className="btn-primary">+ Add user</Link>}
      />
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>Email</th><th>Name</th><th>Role</th><th>Created</th>
              <th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === me?.id;
                const del = deleteUser.bind(null, u.id);
                return (
                  <tr key={u.id}>
                    <td className="font-medium">
                      {u.email}
                      {isMe && <span className="ml-2 text-[10px] badge-amber">you</span>}
                    </td>
                    <td>{u.full_name || <span className="text-slate-400">—</span>}</td>
                    <td><span className={ROLE_BADGE[u.role] ?? 'badge-slate'}>{u.role}</span></td>
                    <td className="text-xs">{shortDate(u.created_at)}</td>
                    <td className="text-right whitespace-nowrap">
                      <Link href={`/settings/users/${u.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <Link href={`/settings/users/${u.id}/password`} className="text-amber-600 hover:underline text-xs mr-3">Password</Link>
                      {!isMe && <DeleteButton action={del} description={`Permanently delete ${u.email}.`} />}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-slate-500 text-sm py-6 text-center">No users.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Owner can edit any user's email, name, role, and password — no old-password verification required.
      </p>
    </div>
  );
}
