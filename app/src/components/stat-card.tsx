export default function StatCard({
  label, value, hint, tone = 'default', size = 'md',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'good' | 'bad';
  size?: 'sm' | 'md';
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-700' :
    tone === 'bad'  ? 'text-rose-700'    :
    'text-slate-900';
  const valueSize = size === 'sm' ? 'text-base font-semibold' : 'text-xl font-bold';
  return (
    <div className="bg-white border border-slate-200 rounded-md px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium leading-tight">{label}</div>
      <div className={`${valueSize} mt-0.5 ${toneClass} tabular-nums leading-tight`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}
