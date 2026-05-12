import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function setPassword(targetId: string, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const pw = String(formData.get('password') ?? '');
  if (pw.length < 6) throw new Error('Password must be at least 6 characters.');
  const { error } = await supabase.rpc('admin_set_password', { target_id: targetId, new_password: pw });
  if (error) throw new Error(error.message);
  redirect('/settings/users?changed=password');
}

export default async function ChangePassword({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: users }, { data: { user: me } }] = await Promise.all([
    supabase.rpc('admin_list_users'),
    supabase.auth.getUser(),
  ]);
  const myRole = (me?.app_metadata?.role as string | undefined) ?? '';
  if (myRole !== 'owner') {
    return (<div className="page-narrow"><PageHeader title="Change password" /><div className="card text-sm text-rose-700">Owner role required.</div></div>);
  }
  const u = (users ?? []).find((x: { id: string }) => x.id === id);
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
