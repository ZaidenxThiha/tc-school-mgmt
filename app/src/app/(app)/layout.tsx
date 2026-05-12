import Sidebar from '@/components/sidebar';
import { createClient } from '@/lib/supabase/server';

// Convention: edge runtime is declared once here at the (app) group layout
// and inherited by every page underneath. Do not re-declare in leaf pages.
// Routes outside this group (login, auth handlers) declare their own runtime.
export const runtime = 'edge';

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
