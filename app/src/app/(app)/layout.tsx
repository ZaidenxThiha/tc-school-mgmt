import Sidebar from '@/components/sidebar';
import CommandPalette from '@/components/command-palette';
import { auth } from '@/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="lg:flex">
      <Sidebar email={session?.user?.email ?? null} />
      <main className="flex-1 min-h-screen w-full lg:w-auto overflow-x-hidden">{children}</main>
      <CommandPalette />
    </div>
  );
}
