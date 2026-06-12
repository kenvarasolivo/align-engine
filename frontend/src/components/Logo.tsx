import { useId } from "react";

interface LogoMarkProps {
  /** Tailwind sizing classes, e.g. "h-7 w-7" (nav) or "h-12 w-12" (hero). */
  className?: string;
}

/**
 * ALIGN brand mark — two strokes converging into register over an
 * alignment rule. Open shape, gradient strokes, no container box.
 * Reads at 28px and scales cleanly to 64px.
 */
export function LogoMark({ className = "h-7 w-7" }: LogoMarkProps) {
  // Unique gradient ids so multiple marks can coexist on one page.
  const uid = useId();
  const legs = `align-legs-${uid}`;
  const rule = `align-rule-${uid}`;

  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={legs} x1="6" y1="28" x2="27" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052FF" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id={rule} x1="8" y1="20" x2="29" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B8CDFF" />
          <stop offset="1" stopColor="#3B82F6" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* Alignment rule — sits behind the legs and runs past them */}
      <path
        d="M8.7 20.2h19"
        stroke={`url(#${rule})`}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* Two strokes snapping into a shared apex — an open "A" */}
      <path
        d="M5.5 27 16 5"
        stroke={`url(#${legs})`}
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path
        d="M26.5 27 16 5"
        stroke={`url(#${legs})`}
        strokeWidth="3.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
