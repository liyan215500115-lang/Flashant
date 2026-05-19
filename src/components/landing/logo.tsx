import { LogoMark } from "@/components/landing/logo-mark";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  showTagline?: boolean;
  tagline?: string;
  className?: string;
}

export function Logo({
  size = 28,
  showTagline = false,
  tagline,
  className,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <div className="leading-tight">
        <div
          className="font-bold text-brand-900 tracking-tight"
          style={{ fontSize: size * 0.46 }}
        >
          Flashant
        </div>
        {showTagline && tagline && (
          <div
            className="text-zinc-400"
            style={{ fontSize: size * 0.33 }}
          >
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
}
