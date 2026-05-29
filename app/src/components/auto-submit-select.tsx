'use client';

import { useRouter } from 'next/navigation';

// A <select> that navigates to the same page with an updated query param when
// changed — used to reload server-rendered, dependent dropdowns (e.g. pick a
// student → reload their invoices) without client data fetching.
export default function AutoSubmitSelect({
  name,
  param,
  value,
  basePath,
  carry = {},
  className,
  children,
}: {
  name: string;
  param: string;
  value: string;
  basePath: string;
  carry?: Record<string, string | undefined>;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <select
      name={name}
      defaultValue={value}
      className={className}
      onChange={(e) => {
        const qs = new URLSearchParams();
        Object.entries(carry).forEach(([k, v]) => v && qs.set(k, v));
        if (e.target.value) qs.set(param, e.target.value);
        else qs.delete(param);
        router.push(`${basePath}?${qs.toString()}`);
      }}
    >
      {children}
    </select>
  );
}
