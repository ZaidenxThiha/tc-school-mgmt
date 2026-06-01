import { auth } from '@/auth';

// Role helpers replacing Supabase RLS. Server-side only.
export async function currentRole(): Promise<string> {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role ?? 'readonly';
}

// Throws if the current user's role is not in `allowed`. Use in server actions
// and route handlers that mutate data (the old RLS write policies).
export async function requireRole(allowed: readonly string[]): Promise<void> {
  const role = await currentRole();
  if (!allowed.includes(role)) throw new Error('Forbidden: insufficient permissions');
}

// Common permission sets mirroring the old RLS policies.
export const WRITE_FINANCE = ['owner', 'admin', 'accounts'] as const; // invoices, payments, ledger
export const WRITE_ADMIN = ['owner', 'admin'] as const;               // students, schedule, sections, employees
