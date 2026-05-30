'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Search } from 'lucide-react';

const PAGES: { label: string; href: string }[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Students', href: '/students' },
  { label: 'Enrollment', href: '/enrolments' },
  { label: 'Employees', href: '/employees' },
  { label: 'Payroll', href: '/payroll' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Sections', href: '/sections' },
  { label: 'Billing', href: '/billing' },
  { label: 'Payments', href: '/payments' },
  { label: 'Expenses', href: '/expenses' },
  { label: 'Inventory', href: '/inventory' },
  { label: 'Events', href: '/events' },
  { label: 'Reports', href: '/reports' },
  { label: 'Settings', href: '/settings' },
  { label: 'New payment', href: '/payments/new' },
  { label: 'New student', href: '/students/new' },
  { label: 'New enrolment', href: '/enrolments/new' },
];

type Student = { id: number; name: string };

// Cmd/Ctrl-K command palette: jump to any page or student from anywhere.
// Students are fetched (authenticated browser client) the first time it opens,
// so it adds no per-page cost.
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    createClient()
      .from('students')
      .select('id, english_name, myanmar_name')
      .order('english_name')
      .limit(2000)
      .then(({ data }) => {
        setStudents((data ?? []).map((s) => ({ id: s.id, name: s.english_name ?? s.myanmar_name ?? `#${s.id}` })));
      });
  }, [open, loaded]);

  const term = q.trim().toLowerCase();
  const { pageHits, studentHits } = useMemo(() => ({
    pageHits: (term ? PAGES.filter((p) => p.label.toLowerCase().includes(term)) : PAGES).slice(0, 6),
    studentHits: term ? students.filter((s) => s.name.toLowerCase().includes(term) || String(s.id) === term).slice(0, 8) : [],
  }), [term, students]);

  function go(href: string) {
    setOpen(false);
    setQ('');
    router.push(href);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (studentHits[0]) go(`/students/${studentHits[0].id}`);
    else if (pageHits[0]) go(pageHits[0].href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-black/40" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={onSubmit} className="flex items-center gap-2 px-3 border-b border-slate-200">
          <Search size={16} className="text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a student or page…"
            className="flex-1 py-3 text-sm outline-none"
          />
          <kbd className="text-[10px] text-slate-400 border border-slate-200 rounded px-1">esc</kbd>
        </form>
        <div className="max-h-[55vh] overflow-auto py-1">
          {studentHits.length > 0 && (
            <Section title="Students">
              {studentHits.map((s) => (
                <Item key={`s-${s.id}`} onClick={() => go(`/students/${s.id}`)}>{s.name} <span className="text-slate-400">#{s.id}</span></Item>
              ))}
            </Section>
          )}
          <Section title="Pages">
            {pageHits.map((p) => (
              <Item key={p.href} onClick={() => go(p.href)}>{p.label}</Item>
            ))}
          </Section>
          {term && studentHits.length === 0 && pageHits.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No matches.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">{title}</div>
      {children}
    </div>
  );
}
function Item({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="block w-full text-left px-4 py-2 text-sm hover:bg-brand-50 hover:text-brand-700">
      {children}
    </button>
  );
}
