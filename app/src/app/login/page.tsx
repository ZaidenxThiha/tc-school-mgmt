'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export const runtime = 'edge';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [status, setStatus] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'error'; msg?: string }>({ kind: 'idle' });

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: 'sending' });
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) setStatus({ kind: 'error', msg: error.message });
    else setStatus({ kind: 'sent', msg: `Magic link sent to ${email}. Check your inbox.` });
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: 'sending' });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setStatus({ kind: 'error', msg: error.message });
    else router.replace('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Thazin &amp; Cherry</h1>
          <p className="text-slate-500 text-sm mt-1">English Training Centre · Internal</p>
        </div>

        <div className="card">
          <div className="flex gap-2 mb-5 text-sm">
            <button
              onClick={() => setMode('magic')}
              className={`flex-1 py-2 rounded-md font-medium ${mode === 'magic' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Magic link
            </button>
            <button
              onClick={() => setMode('password')}
              className={`flex-1 py-2 rounded-md font-medium ${mode === 'password' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              Password
            </button>
          </div>

          <form onSubmit={mode === 'magic' ? sendMagicLink : signInWithPassword} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
            </div>
            {mode === 'password' && (
              <div>
                <label className="label">Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
              </div>
            )}
            <button type="submit" disabled={status.kind === 'sending'} className="btn-primary w-full">
              {status.kind === 'sending' ? 'Working…' : mode === 'magic' ? 'Send magic link' : 'Sign in'}
            </button>
          </form>

          {status.kind === 'sent' && <p className="mt-4 text-sm text-emerald-700">{status.msg}</p>}
          {status.kind === 'error' && <p className="mt-4 text-sm text-rose-700">{status.msg}</p>}
        </div>
      </div>
    </div>
  );
}
