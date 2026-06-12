import { Upload, Wand2, PackageOpen } from "lucide-react";

interface StepDef {
  title: string;
  desc: string;
}

interface WorkflowStepsProps {
  title: string;
  subtitle: string;
  steps: StepDef[];
}

const ICONS = [Upload, Wand2, PackageOpen] as const;

export function WorkflowSteps({ title, subtitle, steps }: WorkflowStepsProps) {
  return (
    <section className="py-32 md:py-40 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16 animate-on-scroll">
          <h2 className="text-2xl md:text-3xl font-bold text-brand-900 tracking-tight">
            {title}
          </h2>
          <p className="mt-3 text-sm text-zinc-500">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {steps.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <div
                key={step.title}
                className="relative flex flex-col items-center text-center group"
              >
                {/* Step number badge */}
                <span className="absolute -top-3 left-4 text-7xl font-bold text-brand-50/60 select-none pointer-events-none">
                  {i + 1}
                </span>

                <div className="relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 text-brand-900 mb-5 group-hover:bg-brand-900 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-lg group-hover:shadow-brand-900/15">
                  <Icon size={24} />
                </div>

                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
