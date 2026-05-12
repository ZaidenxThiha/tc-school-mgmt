import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';
import { shortDate } from '@/lib/format';
import DeleteButton from '@/components/delete-button';


const ROLE_BADGE: Record<string, string> = {
  owner: 'badge-amber',
  admin: 'badge-green',
  accounts: 'badge-slate',
  readonly: 'badge-slate',
};

async function deleteUser(targetId: string) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_delete_user', { target_id: targetId });
  if (error) throw new Error(error.message);
  revalidatePath('/settings/users');
}

export default async function UsersPage() {
  const supabase = await createClient();
  const [{ data: users, error }, { data: { user: me } }] = await Promise.all([
    supabase.rpc('admin_list_users'),
    supabase.auth.getUser(),
  ]);
  const myRole = (me?.app_metadata?.role as string | undefined) ?? '';
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

  return (
    <div className="page">
      <PageHeader
        title="Users"
        subtitle={`${users?.length ?? 0} accounts · owner-only management`}
        actions={<Link href="/settings/users/new" className="btn-primary">+ Add user</Link>}
      />
      {error && <div className="card text-sm text-rose-700 mb-3">{error.message}</div>}
      <div className="card p-0 overflow-hidden">
        <div className="table-scroll">
          <table className="table">
            <thead><tr>
              <th>Email</th><th>Name</th><th>Role</th><th>Created</th><th>Last sign-in</th>
              <th className="text-right">Actions</th>
            </tr></thead>
            <tbody>
              {(users ?? []).map((u: { id: string; email: string; full_name: string | null; role: string; created_at: string; last_sign_in_at: string | null }) => {
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
                    <td className="text-xs">{u.last_sign_in_at ? shortDate(u.last_sign_in_at) : <span className="text-slate-400">—</span>}</td>
                    <td className="text-right whitespace-nowrap">
                      <Link href={`/settings/users/${u.id}/edit`} className="text-brand-600 hover:underline text-xs mr-3">Edit</Link>
                      <Link href={`/settings/users/${u.id}/password`} className="text-amber-600 hover:underline text-xs mr-3">Password</Link>
                      {!isMe && <DeleteButton action={del} description={`Permanently delete ${u.email}.`} />}
                    </td>
                  </tr>
                );
              })}
              {(users?.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-slate-500 text-sm py-6 text-center">No users.</td></tr>
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
