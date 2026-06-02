// Small coercion helpers for inline page server actions, so a malformed or
// replayed POST can't slip a 0 / NaN past a required <select> or number input.

// Required positive-integer id (FK columns). Throws on missing/invalid.
export function reqId(formData: FormData, name: string): number {
  const n = Number(formData.get(name));
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${name}.`);
  return n;
}

// Money/number field → finite number, falling back to `dflt` when blank/invalid.
export function money(formData: FormData, name: string, dflt = 0): number {
  const raw = formData.get(name);
  const n = Number(raw ?? dflt);
  return Number.isFinite(n) ? n : dflt;
}

// Optional money field → finite number, or null when blank/invalid/zero-equivalent.
export function optMoney(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
