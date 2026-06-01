'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'sending' | 'error'; msg?: string }>({ kind: 'idle' });

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
          <form onSubmit={signInWithPassword} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            </div>
            <button type="submit" disabled={status.kind === 'sending'} className="btn-primary w-full">
              {status.kind === 'sending' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {status.kind === 'error' && <p className="mt-4 text-sm text-rose-700">{status.msg}</p>}
        </div>
      </div>
    </div>
  );
}
