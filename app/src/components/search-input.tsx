'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';

// Debounced search box: updates the `q` URL param as you type (preserving other
// filters) so list pages filter live — no "Filter" button click needed.
export default function SearchInput({
  placeholder, className, defaultValue = '', delay = 300,
}: { placeholder?: string; className?: string; defaultValue?: string; delay?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (value: string) => {
    const qs = new URLSearchParams(params.toString());
    if (value) qs.set('q', value); else qs.delete('q');
    qs.delete('page'); // reset to first page on a new search
    startTransition(() => router.push(`${pathname}?${qs.toString()}`));
  };

  return (
    <div className="relative">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          const v = e.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => push(v), delay);
        }}
      />
      {isPending && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">…</span>
      )}
    </div>
  );
}
