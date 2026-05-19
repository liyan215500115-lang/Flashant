import { Zap, Check } from "lucide-react";

interface RoiRowDef {
  label: string;
  old: string;
  new: string;
}

interface RoiTableProps {
  title: string;
  subtitle: string;
  col1: string;
  col2: string;
  rows: RoiRowDef[];
  winner: string;
}

export function RoiTable({
  title,
  subtitle,
  col1,
  col2,
  rows,
  winner,
}: RoiTableProps) {
  return (
    <section className="py-24 md:py-32 px-6 bg-zinc-50/50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-brand-900 tracking-tight">
            {title}
          </h2>
          <p className="mt-3 text-sm text-zinc-500">{subtitle}</p>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-3 bg-brand-900 text-white">
            <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" />
            <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 line-through">
              {col1}
            </div>
            <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={12} className="text-holo-400" />
              {col2}
            </div>
          </div>

          {/* Rows */}
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-3 ${
                i < rows.length - 1 ? "border-b border-zinc-100" : ""
              }`}
            >
              <div className="px-5 py-4 text-sm font-medium text-zinc-500">
                {row.label}
              </div>
              <div className="px-5 py-4 text-sm text-zinc-400 line-through">
                {row.old}
              </div>
              <div className="px-5 py-4 text-sm font-medium text-brand-900 flex items-center gap-1.5">
                <Check size={14} className="text-holo-500 shrink-0" />
                {row.new}
              </div>
            </div>
          ))}

          {/* Winner banner */}
          <div className="px-5 py-3 bg-gold-50 border-t border-gold-500/20 text-center">
            <span className="text-xs font-semibold text-gold-500 uppercase tracking-wider">
              {winner}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
