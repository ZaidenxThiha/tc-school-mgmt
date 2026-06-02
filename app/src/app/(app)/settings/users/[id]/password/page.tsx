import { notFound, redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { requireRole } from '@/lib/auth-guard';
import PageHeader from '@/components/page-header';


const OWNER = ['owner'] as const;

async function setPassword(targetId: string, formData: FormData) {
  'use server';
  await requireRole(OWNER);
  const pw = String(formData.get('password') ?? '');
  if (pw.length < 6) throw new Error('Password must be at least 6 characters.');
  const hash = await bcrypt.hash(pw, 10);
  const res = await sql`update users set password_hash = ${hash} where id = ${targetId}`;
  if (res.count === 0) throw new Error('User not found.');
  redirect('/settings/users?changed=password');
}

export default async function ChangePassword({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const myRole = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (myRole !== 'owner') {
    return (<div className="page-narrow"><PageHeader title="Change password" /><div className="card text-sm text-rose-700">Owner role required.</div></div>);
  }
  const rows = (await sql`select id, email, full_name from users where id = ${id} limit 1`) as unknown as
    { id: string; email: string; full_name: string | null }[];
  const u = rows[0];
  if (!u) notFound();
  const action = setPassword.bind(null, id);
  return (
    <div className="page-narrow">
      <PageHeader title="Change password" subtitle={`${u.email} · ${u.full_name ?? ''}`} />
      <form action={action} className="card space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900">
          ⚡ Direct change — no current-password verification. The new password is hashed (bcrypt) before storage.
        </div>
        <div><label className="label">New password</label>
          <input name="password" type="text" required minLength={6} autoFocus className="input"
                 placeholder="≥6 characters" /></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/settings/users" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Set password</button>
        </div>
      </form>
    </div>
  );
}
