import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

// Role helpers replacing Supabase RLS. Server-side only.
export async function currentRole(): Promise<string> {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role ?? 'readonly';
}

// Re-verify the currently signed-in user's own password (server-side, bcrypt).
// Used to confirm destructive actions like restore, replacing the old hardcoded
// client-side `admin123` check. Returns false if no session or wrong password.
export async function verifyCurrentPassword(password: string): Promise<boolean> {
  if (!password) return false;
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return false;
  const rows = await sql`select password_hash from users where id = ${id} limit 1`;
  const hash = rows[0]?.password_hash;
  if (!hash) return false;
  return bcrypt.compare(password, hash);
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
