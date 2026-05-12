import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function create(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_create_user', {
    new_email: String(formData.get('email') ?? '').trim(),
    new_password: String(formData.get('password') ?? ''),
    new_full_name: String(formData.get('full_name') ?? '').trim(),
    new_role: String(formData.get('role') ?? 'readonly'),
  });
  if (error) throw new Error(error.message);
  redirect('/settings/users');
}

export default async function NewUser() {
  const supabase = await createClient();
  const { data: { user: me } } = await supabase.auth.getUser();
  const myRole = (me?.app_metadata?.role as string | undefined) ?? '';
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
          </select></div>
        <div className="flex gap-2 justify-end pt-2">
          <a href="/settings/users" className="btn-ghost">Cancel</a>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </div>
  );
}
