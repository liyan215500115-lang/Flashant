import { cn } from "@/lib/utils";

/** Brand icon variants using the Flashant elephant motif */
interface BrandIconProps {
  size?: number;
  variant?: "filled" | "outline" | "minimal";
  className?: string;
}

export function BrandIcon({ size = 24, variant = "filled", className }: BrandIconProps) {
  if (variant === "minimal") {
    // Just the lightning bolt — for favicons or tiny icons
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn("shrink-0", className)} aria-label="Flashant">
        <path d="M12 2L9 10H12L10 16L17 7H13L16 2Z" fill="#F59E0B" stroke="#F59E0B" strokeWidth="0.5" strokeLinejoin="round" />
      </svg>
    );
  }

  if (variant === "outline") {
    // Elephant outline only — for subtle placements
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn("shrink-0", className)} aria-label="Flashant">
        <circle cx="24" cy="24" r="23" stroke="currentColor" strokeWidth="1.5" />
        <path d="M22 18C21 14 23 10 26 10C28 9 30 11 30 14L30 18L29 22C28 24 25 25 24 25C23 25 20 24 19 22L18 18C18 15 19 12 22 10C25 9 27 11 28 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M20 29L19 33C19 34 20 35 22 35H26C28 35 29 34 29 33L28 29" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="21" cy="22" r="1" fill="currentColor" />
        <circle cx="27" cy="22" r="1" fill="currentColor" />
        <path d="M24 16L22 20H24L23 24L28 18H25L27 16Z" fill="#F59E0B" />
      </svg>
    );
  }

  // filled — full color elephant like the logo
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn("shrink-0", className)} aria-label="Flashant">
      <rect width="48" height="48" rx="12" fill="#1E3A8A" />
      <path d="M4 22C3 15 5 9 10 7C15 6 18 9 20 13L20 21L18 32C15 36 9 36 6 32C4 28 4 25 4 22Z" fill="white" />
      <path d="M44 22C45 15 43 9 38 7C33 6 30 9 28 13L28 21L30 32C33 36 39 36 42 32C44 28 44 25 44 22Z" fill="white" />
      <circle cx="24" cy="21" r="10" fill="white" />
      <path d="M20 28L19 35Q19 39 22 39L26 39Q29 39 29 35L28 28Z" fill="white" />
      <circle cx="20" cy="19" r="1.3" fill="#1E3A8A" />
      <circle cx="28" cy="19" r="1.3" fill="#1E3A8A" />
      <path d="M23 5L20 13H23L21 19L28 10H24L27 5Z" fill="#F59E0B" />
    </svg>
  );
}
