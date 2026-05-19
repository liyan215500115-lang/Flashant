import { Sparkles, Globe, ShieldCheck, Zap } from "lucide-react";

interface FeatureDef {
  title: string;
  description: string;
}

interface FeatureGridProps {
  features: FeatureDef[];
}

const ICONS = [Sparkles, Globe, ShieldCheck, Zap] as const;
const SPANS = ["md:col-span-2", "md:col-span-1", "md:col-span-1", "md:col-span-2"] as const;
const ACCENTS = ["text-blue-600", "text-zinc-900", "text-zinc-900", "text-blue-600"] as const;

export function FeatureGrid({ features }: FeatureGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      {features.map((feature, i) => {
        const Icon = ICONS[i];
        return (
          <div
            key={feature.title}
            className={`${SPANS[i]} group relative rounded-2xl border border-zinc-100 bg-white p-6 md:p-8 transition-all duration-300 hover:shadow-md`}
          >
            <div
              className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-50 mb-4 transition-colors group-hover:bg-zinc-100`}
            >
              <Icon size={18} className={ACCENTS[i]} />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">
              {feature.title}
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-md">
              {feature.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
