'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type ComboOption = { id: number; label: string };

// Type-to-search student picker. Two modes:
//  - field mode (pass `name`): keeps a hidden input for normal form submission.
//  - navigate mode (pass `param` + `basePath`): pushes ?param=id on select, used
//    where choosing a student reloads server data (e.g. their open invoices).
export default function StudentCombobox({
  options, name, param, basePath, carry = {}, defaultId, placeholder = 'Type a name or ID…',
}: {
  options: ComboOption[];
  name?: string;
  param?: string;
  basePath?: string;
  carry?: Record<string, string | undefined>;
  defaultId?: number | '';
  placeholder?: string;
}) {
  const router = useRouter();
  const initial = options.find((o) => o.id === defaultId);
  const [query, setQuery] = useState(initial?.label ?? '');
  const [selectedId, setSelectedId] = useState<number | ''>(defaultId ?? '');
  const [open, setOpen] = useState(false);

  const term = query.trim().toLowerCase();
  const filtered = (term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options).slice(0, 50);

  function choose(o: ComboOption) {
    setSelectedId(o.id);
    setQuery(o.label);
    setOpen(false);
    if (param && basePath) {
      const qs = new URLSearchParams();
      Object.entries(carry).forEach(([k, v]) => v && qs.set(k, v));
      qs.set(param, String(o.id));
      router.push(`${basePath}?${qs.toString()}`);
    }
  }

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={selectedId} />}
      <input
        type="text"
        autoComplete="off"
        className="input"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setSelectedId(''); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg text-sm">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={() => choose(o)}
                className={`block w-full text-left px-3 py-2 hover:bg-slate-50 ${o.id === selectedId ? 'bg-brand-50 text-brand-700' : ''}`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && term && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg px-3 py-2 text-sm text-slate-500">
          No match
        </div>
      )}
    </div>
  );
}
