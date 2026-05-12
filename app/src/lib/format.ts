const fmt = new Intl.NumberFormat('en-US');

export function mmk(amount: number | bigint | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'bigint' ? Number(amount) : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return fmt.format(n) + ' MMK';
}

export function num(n: number | bigint | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '0';
  const v = typeof n === 'bigint' ? Number(n) : Number(n);
  return Number.isFinite(v) ? fmt.format(v) : '0';
}

export function shortDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function monthLabel(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
