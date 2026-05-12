import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageHeader from '@/components/page-header';


async function save(targetId: string, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_user', {
    target_id: targetId,
    new_email: String(formData.get('email') ?? '').trim(),
    new_full_name: String(formData.get('full_name') ?? '').trim(),
    new_role: String(formData.get('role') ?? 'readonly'),
  });
  if (error) throw new Error(error.message);
  redirect('/settings/users');
}

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: users }, { data: { user: me } }] = await Promise.all([
    supabase.rpc('admin_list_users'),
    supabase.auth.getUser(),
  ]);
  const myRole = (me?.app_metadata?.role as string | undefined) ?? '';
  if (myRole !== 'owner') {
    return (<div className="page-narrow"><PageHeader title="Edit user" /><div className="card text-sm text-rose-700">Owner role required.</div></div>);
  }
  const u = (users ?? []).find((x: { id: string }) => x.id === id);
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
