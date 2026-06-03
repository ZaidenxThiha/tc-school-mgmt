import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import authConfig from '@/auth.config';

// Lock an email after this many failed attempts within the window.
const MAX_FAILS = 5;

// Inline audit insert (kept here rather than importing @/lib/audit to avoid a
// circular import — audit.ts imports this module's `auth`).
async function logAuth(action: string, changedBy: string | null, detail: object) {
  try {
    await sql`insert into audit_log (table_name, row_id, action, changed_by, diff)
      values ('auth', ${changedBy}, ${action}, ${changedBy}, ${sql.json(detail as Parameters<typeof sql.json>[0])})`;
  } catch (e) {
    console.error('[audit] login event failed', e);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds, request) => {
        const email = String(creds?.email ?? '').trim().toLowerCase();
        const password = String(creds?.password ?? '');
        if (!email || !password) return null;
        const ip = (request?.headers?.get?.('x-forwarded-for') ?? '').split(',')[0].trim() || null;

        // Rate limit: too many recent failures for this email → reject without
        // even checking the password.
        const fails = await sql`
          select count(*)::int as n from login_attempts
          where lower(email) = ${email} and success = false
            and attempted_at > now() - interval '15 minutes'`;
        if ((fails[0]?.n ?? 0) >= MAX_FAILS) {
          await sql`insert into login_attempts (email, ip, success) values (${email}, ${ip}, false)`;
          await logAuth('login_blocked', null, { email, ip });
          return null;
        }

        const rows = await sql`
          select id, email, password_hash, role, full_name
          from users where lower(email) = ${email} limit 1`;
        const u = rows[0];
        const ok = u ? await bcrypt.compare(password, u.password_hash) : false;

        await sql`insert into login_attempts (email, ip, success) values (${email}, ${ip}, ${ok})`;
        if (!ok) {
          await logAuth('login_failed', u?.id ?? null, { email, ip });
          return null;
        }
        await logAuth('login', u.id, { email, ip });
        return { id: u.id, email: u.email, name: u.full_name ?? u.email, role: u.role };
      },
    }),
  ],
});
