interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Flashant"
    >
      <rect x="0" y="0" width="48" height="48" rx="12" fill="#1E3A8A" />

      {/* Left ear */}
      <path
        d="M 4 22 C 3 15 5 9 10 7 C 15 6 18 9 20 13 L 20 21 L 18 32 C 15 36 9 36 6 32 C 4 28 4 25 4 22 Z"
        fill="white"
      />

      {/* Right ear */}
      <path
        d="M 44 22 C 45 15 43 9 38 7 C 33 6 30 9 28 13 L 28 21 L 30 32 C 33 36 39 36 42 32 C 44 28 44 25 44 22 Z"
        fill="white"
      />

      {/* Head */}
      <circle cx="24" cy="21" r="10" fill="white" />

      {/* Trunk */}
      <path
        d="M 20 28 L 19 35 Q 19 39 22 39 L 26 39 Q 29 39 29 35 L 28 28 Z"
        fill="white"
      />

      {/* Eyes */}
      <circle cx="20" cy="19" r="1.3" fill="#1E3A8A" />
      <circle cx="28" cy="19" r="1.3" fill="#1E3A8A" />

      {/* Gold lightning */}
      <path
        d="M 23 5 L 20 13 L 23 13 L 21 19 L 28 10 L 24 10 L 27 5 Z"
        fill="#F59E0B"
      />
    </svg>
  );
}
