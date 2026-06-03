import type { NextAuthConfig } from 'next-auth';

// Edge-safe config (no DB / bcrypt) — shared by middleware and the full auth.ts.
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const p = nextUrl.pathname;
      // /api/cron/* is gated by CRON_SECRET in the route itself (Vercel Cron
      // sends a Bearer token, not a session cookie), so it bypasses the auth gate.
      const isPublic = p === '/login' || p.startsWith('/auth') || p.startsWith('/api/auth') || p.startsWith('/api/cron');
      if (isPublic) return true;
      return isLoggedIn; // unauthenticated → redirected to /login
    },
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const u = session.user as { id?: string; role?: string };
        u.role = token.role as string | undefined;
        if (token.sub) u.id = token.sub; // expose the user id (used for re-auth, self-delete guard)
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
