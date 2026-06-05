import type { NextAuthConfig } from 'next-auth';
import { NextResponse } from 'next/server';

// Edge-safe config (no DB / bcrypt) — shared by middleware and the full auth.ts.
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: string } | undefined)?.role;
      const p = nextUrl.pathname;
      // /api/cron/* is gated by CRON_SECRET in the route itself (Vercel Cron
      // sends a Bearer token, not a session cookie), so it bypasses the auth gate.
      const isPublic = p === '/login' || p.startsWith('/auth') || p.startsWith('/api/auth') || p.startsWith('/api/cron');
      if (isPublic) return true;
      if (!isLoggedIn) return false; // unauthenticated → redirected to /login

      // The dedicated 'attendance' role can ONLY use the Face Attendance camera:
      // the scan page plus the recognize/record APIs it calls. Anything else is
      // bounced back to the scanner.
      if (role === 'attendance') {
        const allowed =
          p === '/attendance/scan' ||
          p.startsWith('/api/face-recognition') ||
          p === '/api/attendance/face-record';
        return allowed ? true : NextResponse.redirect(new URL('/attendance/scan', nextUrl));
      }
      return true;
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
