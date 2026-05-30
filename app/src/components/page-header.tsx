export default function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start sm:items-end justify-between mb-4 sm:mb-6 gap-3 flex-wrap border-b border-slate-200 pb-3 sm:pb-4">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
