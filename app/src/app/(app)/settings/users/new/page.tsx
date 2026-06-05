import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { requireRole } from '@/lib/auth-guard';
import { audit } from '@/lib/audit';
import PageHeader from '@/components/page-header';


const OWNER = ['owner'] as const;
const ROLES = ['owner', 'admin', 'accounts', 'readonly', 'attendance'];

async function create(formData: FormData) {
  'use server';
  await requireRole(OWNER);
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim() || null;
  const role = String(formData.get('role') ?? 'readonly');
  if (!email) throw new Error('Email is required.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  if (!ROLES.includes(role)) throw new Error('Invalid role.');

  const existing = await sql`select 1 from users where lower(email) = ${email} limit 1`;
  if (existing.length) throw new Error('A user with that email already exists.');

  const hash = await bcrypt.hash(password, 10);
  const rows = await sql`insert into users (email, password_hash, full_name, role)
            values (${email}, ${hash}, ${fullName}, ${role}) returning id`;
  await audit({ table: 'users', action: 'user_create', rowId: rows[0]?.id, diff: { email, role } });
  redirect('/settings/users');
}

export default async function NewUser() {
  const session = await auth();
  const myRole = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (myRole !== 'owner') {
    return (
      <div className="page-narrow">
        <PageHeader title="Add user" />
        <div className="card text-sm text-rose-700">Owner role required.</div>
      </div>
    );
  }
  return (
    <div className="page-narrow">
      <PageHeader title="Add user" subtitle="Create a new login account" />
      <form action={create} className="card space-y-4">
        <div><label className="label">Email</label>
          <input name="email" type="email" required className="input" placeholder="user@example.com" /></div>
        <div><label className="label">Full name</label>
          <input name="full_name" className="input" placeholder="(optional)" /></div>
        <div><label className="label">Password</label>
          <input name="password" type="text" required minLength={6} className="input"
                 placeholder="≥6 characters" /></div>
        <div><label className="label">Role</label>
          <select name="role" defaultValue="readonly" required className="input">
            <option value="owner">Owner — full control + user management</option>
            <option value="admin">Admin — full data CRUD, no user management</option>
            <option value="accounts">Accounts — payments + ledger only</option>
            <option value="readonly">Read-only</option>
            <option value="attendance">Attendance — face attendance camera only</option>
          </select></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/settings/users" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
