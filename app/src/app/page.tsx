import { redirect } from 'next/navigation';

// Forwards Supabase magic-link callbacks that landed on `/` because of a
// misconfigured Site URL. If `?code=...` (PKCE) or `?token_hash=...&type=...`
// (email OTP) is present, hand off to /auth/callback which exchanges for a session.
export default async function Home({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const code = typeof sp.code === 'string' ? sp.code : null;
  const tokenHash = typeof sp.token_hash === 'string' ? sp.token_hash : null;
  const type = typeof sp.type === 'string' ? sp.type : null;
  const next = typeof sp.next === 'string' ? sp.next : '/dashboard';

  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
  }
  if (tokenHash && type) {
    redirect(`/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next)}`);
  }
  redirect('/dashboard');
}
