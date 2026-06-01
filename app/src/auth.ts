import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import authConfig from '@/auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? '').trim().toLowerCase();
        const password = String(creds?.password ?? '');
        if (!email || !password) return null;
        const rows = await sql`
          select id, email, password_hash, role, full_name
          from users where lower(email) = ${email} limit 1`;
        const u = rows[0];
        if (!u) return null;
        const ok = await bcrypt.compare(password, u.password_hash);
        if (!ok) return null;
        return { id: u.id, email: u.email, name: u.full_name ?? u.email, role: u.role };
      },
    }),
  ],
});
