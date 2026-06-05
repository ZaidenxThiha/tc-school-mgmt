import Sidebar from '@/components/sidebar';
import CommandPalette from '@/components/command-palette';
import { auth } from '@/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  return (
    <div className="lg:flex">
      <Sidebar email={session?.user?.email ?? null} role={role} />
      <main className="flex-1 min-h-screen w-full lg:w-auto overflow-x-hidden">{children}</main>
      {/* The locked 'attendance' role can't reach the palette's data routes. */}
      {role !== 'attendance' && <CommandPalette />}
    </div>
  );
}
