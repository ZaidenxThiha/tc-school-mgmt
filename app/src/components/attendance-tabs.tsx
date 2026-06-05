'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Sub-navigation for the Attendance section (the sidebar links to /attendance/scan;
// these tabs reach the sibling pages — same pattern as Settings → audit/users).
const TABS = [
  { href: '/attendance/scan', label: 'Face Attendance' },
  { href: '/attendance/record-face', label: 'Record Face' },
  { href: '/attendance/reports', label: 'Student Reports' },
  { href: '/attendance/employee-reports', label: 'Employee Reports' },
  { href: '/attendance/unassigned', label: 'Unassigned' },
  { href: '/attendance/scan-logs', label: 'Scan Logs' },
  { href: '/attendance/corrections', label: 'Corrections' },
];

export default function AttendanceTabs() {
  const path = usePathname();
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`text-xs px-3 py-1.5 rounded-md border ${
              active
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
