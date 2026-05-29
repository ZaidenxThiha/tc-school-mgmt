'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Trash2, Lock, X } from 'lucide-react';

const DELETE_PASSWORD = 'admin123';

export default function DeleteButton({
  action, label = 'Delete',
  description = 'This action cannot be undone.',
  className,
}: {
  action: () => Promise<void>;
  label?: string;
  description?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Optimistic feedback: dim + lock this row the instant deletion starts, so it
  // visibly "goes away" before the server round-trip + revalidation completes.
  useEffect(() => {
    const row = btnRef.current?.closest('tr');
    if (!row) return;
    row.style.transition = 'opacity 150ms';
    row.style.opacity = pending ? '0.35' : '';
    row.style.pointerEvents = pending ? 'none' : '';
  }, [pending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== DELETE_PASSWORD) {
      setError('Incorrect password');
      return;
    }
    setError(null);
    setOpen(false);
    setPw('');
    start(() => action());
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={pending}
        onClick={() => { setOpen(true); setError(null); setPw(''); }}
        className={className ?? 'text-rose-600 hover:text-rose-800 text-xs inline-flex items-center gap-1'}
      >
        <Trash2 size={12} />
        {pending ? '…' : label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" role="dialog">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="bg-rose-100 text-rose-600 rounded-full p-2"><Lock size={16} /></span>
                <div>
                  <div className="font-semibold text-slate-900">Confirm delete</div>
                  <div className="text-xs text-slate-500 leading-snug mt-0.5">{description}</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600 -mt-1 -mr-1">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mt-2">
              <label className="label">Enter delete password</label>
              <input
                type="password"
                autoFocus
                value={pw}
                onChange={(e) => { setPw(e.target.value); setError(null); }}
                placeholder="Required to confirm"
                className="input"
              />
              {error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary bg-rose-600 hover:bg-rose-700">Delete</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
