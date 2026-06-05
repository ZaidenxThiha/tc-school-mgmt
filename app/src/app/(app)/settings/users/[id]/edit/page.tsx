import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { requireRole } from '@/lib/auth-guard';
import { audit } from '@/lib/audit';
import PageHeader from '@/components/page-header';


const OWNER = ['owner'] as const;
const ROLES = ['owner', 'admin', 'accounts', 'readonly', 'attendance'];

async function save(targetId: string, formData: FormData) {
  'use server';
  await requireRole(OWNER);
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim() || null;
  const role = String(formData.get('role') ?? 'readonly');
  if (!email) throw new Error('Email is required.');
  if (!ROLES.includes(role)) throw new Error('Invalid role.');

  const dupe = await sql`select 1 from users where lower(email) = ${email} and id <> ${targetId} limit 1`;
  if (dupe.length) throw new Error('A user with that email already exists.');

  await sql`update users set email = ${email}, full_name = ${fullName}, role = ${role}
            where id = ${targetId}`;
  await audit({ table: 'users', action: 'user_update', rowId: targetId, diff: { email, role } });
  redirect('/settings/users');
}

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const myRole = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (myRole !== 'owner') {
    return (<div className="page-narrow"><PageHeader title="Edit user" /><div className="card text-sm text-rose-700">Owner role required.</div></div>);
  }
  const rows = (await sql`select id, email, full_name, role from users where id = ${id} limit 1`) as unknown as
    { id: string; email: string; full_name: string | null; role: string }[];
  const u = rows[0];
  if (!u) notFound();
  const action = save.bind(null, id);
  return (
    <div className="page-narrow">
      <PageHeader title={`Edit ${u.email}`} subtitle="Owner can change anything below directly." />
      <form action={action} className="card space-y-4">
        <div><label className="label">Email</label>
          <input name="email" type="email" required defaultValue={u.email} className="input" /></div>
        <div><label className="label">Full name</label>
          <input name="full_name" defaultValue={u.full_name ?? ''} className="input" /></div>
        <div><label className="label">Role</label>
          <select name="role" defaultValue={u.role} required className="input">
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="accounts">Accounts</option>
            <option value="readonly">Readonly</option>
            <option value="attendance">Attendance</option>
          </select></div>
        <div className="flex gap-2 justify-end pt-2 flex-wrap">
          <a href="/settings/users" className="btn-ghost">Cancel</a>
          <a href={`/settings/users/${id}/password`} className="btn-ghost">Change password →</a>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
