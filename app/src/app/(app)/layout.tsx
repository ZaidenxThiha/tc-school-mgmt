import Sidebar from '@/components/sidebar';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div className="lg:flex">
      <Sidebar email={user?.email ?? null} />
      <main className="flex-1 min-h-screen w-full lg:w-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
