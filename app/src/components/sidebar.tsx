'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, UserCog, CalendarDays, Calendar, Banknote, UserX,
  Receipt, FileText, Wallet, Boxes, PartyPopper, BarChart3, Settings, Database,
  GraduationCap, ScanFace, LogOut, Menu, X, ChevronLeft, ChevronRight,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/students',   label: 'Students',   icon: Users },
  { href: '/enrolments', label: 'Enrollment', icon: GraduationCap },
  { href: '/employees',  label: 'Employees',  icon: UserCog },
  { href: '/payroll',    label: 'Payroll',    icon: Banknote },
  { href: '/absences',   label: 'Absences',   icon: UserX },
  { href: '/schedule',   label: 'Schedule',   icon: Calendar },
  { href: '/sections',   label: 'Sections',   icon: CalendarDays },
  { href: '/attendance/scan', label: 'Attendance', icon: ScanFace },
  { href: '/billing',    label: 'Billing',    icon: FileText },
  { href: '/payments',   label: 'Payments',   icon: Receipt },
  { href: '/expenses',   label: 'Expenses',   icon: Wallet },
  { href: '/inventory',  label: 'Inventory',  icon: Boxes },
  { href: '/events',     label: 'Events',     icon: PartyPopper },
  { href: '/reports',    label: 'Reports',    icon: BarChart3 },
  { href: '/backup',     label: 'Backup',     icon: Database },
  { href: '/settings',   label: 'Settings',   icon: Settings },
] as const;

export default function Sidebar({ email, role }: { email: string | null; role?: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // The dedicated 'attendance' role is locked to the Face Attendance camera, so
  // its sidebar shows only that one link.
  const nav = role === 'attendance' ? NAV.filter((i) => i.href === '/attendance/scan') : NAV;

  // Restore the desktop collapsed preference (client-only to avoid hydration mismatch).
  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === '1') setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  }

  // Close drawer when navigating
  useEffect(() => { setOpen(false); }, [path]);

  // Lock body scroll while drawer is open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  // collapsed-only classes are lg:-gated, so the mobile drawer is unaffected.
  const labelHide = collapsed ? 'lg:hidden' : '';

  const navList = (
    <nav className="flex-1 py-3 overflow-y-auto lg:overflow-y-visible">
      {nav.map((item) => {
        const active = path === item.href || path.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
              collapsed ? 'lg:justify-center lg:px-0 lg:gap-0' : ''
            } ${active ? 'bg-slate-800 text-white border-l-2 border-brand-500' : 'text-slate-300 hover:bg-slate-800/60'}`}
          >
            <Icon size={16} className="shrink-0" />
            <span className={labelHide}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const signoutBlock = (
    <form action="/auth/signout" method="post" className="p-4 border-t border-slate-800">
      <div className={`text-xs text-slate-400 mb-2 truncate ${labelHide}`} title={email ?? ''}>{email ?? '—'}</div>
      <button
        type="submit"
        title="Sign out"
        className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-md bg-slate-800 hover:bg-slate-700"
      >
        <LogOut size={14} className="shrink-0" /> <span className={labelHide}>Sign out</span>
      </button>
    </form>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-slate-900 text-slate-100 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-1 -ml-1 rounded hover:bg-slate-800">
          <Menu size={22} />
        </button>
        <div className="text-sm font-semibold">Thazin &amp; Cherry</div>
        <div className="w-7" /> {/* spacer */}
      </header>

      {/* Backdrop */}
      {open && (
        <button
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
        />
      )}

      {/* Sidebar — desktop static (collapsible), mobile drawer */}
      <aside
        className={`bg-slate-900 text-slate-100 min-h-screen flex flex-col w-60 lg:static lg:translate-x-0
                    fixed inset-y-0 left-0 z-50 transition-[transform,width] duration-200
                    ${collapsed ? 'lg:w-[4.25rem]' : 'lg:w-60'}
                    ${open ? 'translate-x-0' : '-translate-x-full'} lg:transform-none`}
      >
        <div className={`py-5 border-b border-slate-800 flex items-center justify-between ${collapsed ? 'px-5 lg:px-2 lg:justify-center' : 'px-5'}`}>
          <div className={labelHide}>
            <div className="font-semibold leading-tight">Thazin &amp; Cherry</div>
            <div className="text-xs text-slate-400">Internal · ESL</div>
          </div>
          {/* Desktop collapse toggle */}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-1 rounded hover:bg-slate-800 text-slate-300"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          {/* Mobile close */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="lg:hidden p-1 -mr-1 rounded hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>
        {navList}
        {signoutBlock}
      </aside>
    </>
  );
}
