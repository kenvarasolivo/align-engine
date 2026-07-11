import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, Clock, Menu, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { LogoMark } from "./Logo";
import ThemeToggle from "./ThemeToggle";
import type { AuthMode } from "./LoginPage";

interface LandingPageProps {
  navigate: (to: string) => void;
  /** Jump into /app with the LoginPage opened on the given tab. */
  onOpenAuth: (mode: AuthMode) => void;
}

/** Reveal-on-scroll: returns visible immediately when reduced motion is preferred. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/** Live Aachen (Europe/Berlin) time as HH:MM — the "in London" clock, localised. */
function useLocalTime() {
  const format = () =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Berlin",
    }).format(new Date());

  const [time, setTime] = useState(format);
  useEffect(() => {
    const id = window.setInterval(() => setTime(format()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Contact", href: "mailto:kenvara.solivo@gmail.com" },
];

const FEATURES: { title: string; description: string; icon: ReactNode }[] = [
  {
    title: "Skill Alignment Matrix",
    description: "Instantly see your top matching skills vs. the crucial gaps for any role.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18M3 12h10M3 18h10" />
        <path d="m16 16.5 2.2 2.2L22.5 14" />
      </svg>
    ),
  },
  {
    title: "Editable Drafts",
    description: "A one-page Anschreiben or sub-200-word cold email — nothing ships without your edit.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    title: "English & German",
    description: "Generate either language with one toggle — same analysis, native-quality output.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    title: "Analysis History",
    description: "Every signed-in run is snapshotted — revisit, copy, reload, or delete anytime.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    title: "Resume Vault & Saved Jobs",
    description: "Save resumes once (last-used auto-loads) and bookmark jobs to re-analyze later.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M9 14h6" />
      </svg>
    ),
  },
  {
    title: "Insights",
    description: "Your most-matched skills vs. recurring gaps as a personal learning roadmap, plus usage.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 20h18" />
        <path d="M6 20v-6M11 20V9M16 20v-9M21 20V5" />
      </svg>
    ),
  },
];

const STEPS: { title: string; description: string }[] = [
  {
    title: "Paste resume + job",
    description: "Drop in your resume and the job description — or load both from your vault.",
  },
  {
    title: "Run the analysis",
    description: "ALIGN extracts your skill-alignment matrix: top matches and the gaps that matter.",
  },
  {
    title: "Refine the draft",
    description: "Get an editable Anschreiben or cold email in EN or DE, ready for your final touch.",
  },
];

const MATCHED_SKILLS = ["Python", "React", "REST APIs", "PostgreSQL", "CI/CD"];
const GAP_SKILLS = ["Kubernetes", "Terraform"];

/** Starburst mark used on the hero feature badge. */
const STARBURST_PATH =
  "m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z";

/** Full-bleed looping video backdrop, with a soft scrim for text legibility. */
function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        src="/assets/herobackground.mp4"
      />
      {/* Scrim — darkest at the top-left where the headline sits */}
      <div className="absolute inset-0 bg-gradient-to-br from-surface/70 via-surface/20 to-transparent" />
    </div>
  );
}

/**
 * Pill CTA with the Axion text-roll hover: the label is duplicated inside a
 * clipped column that slides up 50% on hover while the arrow chip rotates.
 */
function RollCta({
  label,
  onClick,
  variant = "cobalt",
  className = "",
}: {
  label: string;
  onClick: () => void;
  variant?: "cobalt" | "invert";
  className?: string;
}) {
  const surface =
    variant === "cobalt"
      ? "bg-cobalt text-white hover:bg-cobalt-hover"
      : "bg-obsidian text-surface hover:opacity-90";
  const arrowInk = variant === "cobalt" ? "text-cobalt" : "text-obsidian";
  const ease = "cubic-bezier(0.25,0.1,0.25,1)";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring group inline-flex items-center gap-3 rounded-full py-2 pl-5 pr-2 text-[13px] font-medium shadow-cta transition-colors duration-300 ${surface} ${className}`}
    >
      <span className="block h-[20px] overflow-hidden">
        <span
          className="flex flex-col transition-transform duration-500 group-hover:-translate-y-1/2"
          style={{ transitionTimingFunction: ease }}
        >
          <span className="flex h-[20px] items-center">{label}</span>
          <span className="flex h-[20px] items-center">{label}</span>
        </span>
      </span>
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full bg-white transition-transform duration-500 group-hover:-rotate-45"
        style={{ transitionTimingFunction: ease }}
      >
        <ArrowRight className={`h-3.5 w-3.5 ${arrowInk}`} strokeWidth={2.4} />
      </span>
    </button>
  );
}

/** Abstract JSX mockup of the ALIGN workspace — stands in for a screenshot. */
function ProductVisual() {
  return (
    <div
      className="card overflow-hidden rounded-2xl shadow-lift motion-safe:animate-float select-none"
      aria-hidden="true"
    >
      {/* Faux app header */}
      <div className="flex h-11 items-center justify-between border-b border-hairline bg-panel px-4">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="text-xs font-extrabold tracking-tight text-obsidian">ALIGN</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-cobalt-50 px-2 py-0.5 text-2xs font-semibold text-cobalt">Anschreiben</span>
          <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-2xs font-medium text-charcoal/50">EN</span>
        </div>
      </div>

      {/* Faux 50/50 workspace */}
      <div className="grid grid-cols-1 gap-3 bg-surface p-3 sm:grid-cols-2 sm:p-4">
        {/* Left: inputs */}
        <div className="flex flex-col gap-3">
          <div className="card rounded-lg p-3.5">
            <p className="label-caps mb-2.5">Your resume</p>
            <div className="space-y-2">
              <div className="h-2 w-11/12 rounded-full bg-surface-sunken" />
              <div className="h-2 w-full rounded-full bg-surface-sunken" />
              <div className="h-2 w-4/5 rounded-full bg-surface-sunken" />
              <div className="h-2 w-2/3 rounded-full bg-surface-sunken" />
            </div>
          </div>
          <div className="card rounded-lg p-3.5">
            <p className="label-caps mb-2.5">Job description</p>
            <div className="space-y-2">
              <div className="h-2 w-full rounded-full bg-surface-sunken" />
              <div className="h-2 w-3/4 rounded-full bg-surface-sunken" />
              <div className="h-2 w-5/6 rounded-full bg-surface-sunken" />
            </div>
            <div className="mt-3.5 flex h-7 items-center justify-center rounded-md bg-cobalt text-2xs font-semibold text-white shadow-cta">
              Analyze alignment
            </div>
          </div>
        </div>

        {/* Right: skill alignment + draft preview */}
        <div className="flex flex-col gap-3">
          <div className="card rounded-lg p-3.5">
            <p className="label-caps mb-2.5">Skill alignment</p>
            <div className="flex flex-wrap gap-1.5">
              {MATCHED_SKILLS.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-success-border bg-success-soft px-2 py-0.5 text-2xs font-medium text-success-strong"
                >
                  ✓ {skill}
                </span>
              ))}
              {GAP_SKILLS.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-warning-border bg-warning-soft px-2 py-0.5 text-2xs font-medium text-warning-strong"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <div className="card flex-1 rounded-lg p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="label-caps">Draft — editable</p>
              <span className="h-3.5 w-0.5 animate-pulse rounded-full bg-cobalt" />
            </div>
            <div className="space-y-2">
              <div className="h-2 w-1/3 rounded-full bg-cobalt-100" />
              <div className="h-2 w-full rounded-full bg-surface-sunken" />
              <div className="h-2 w-11/12 rounded-full bg-surface-sunken" />
              <div className="h-2 w-full rounded-full bg-surface-sunken" />
              <div className="h-2 w-3/5 rounded-full bg-surface-sunken" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpressumDetails() {
  return (
    <details className="text-left">
      <summary className="focus-ring cursor-pointer list-none rounded-md text-xs font-medium text-charcoal/40 transition-colors duration-150 hover:text-cobalt">
        Impressum
      </summary>
      <div className="mt-4 rounded-2xl border border-hairline bg-panel/70 p-5 text-xs leading-relaxed text-charcoal/60 shadow-xs backdrop-blur-sm">
        <h2 className="text-sm font-semibold text-obsidian">Impressum</h2>
        <p className="mt-3 font-medium text-charcoal/70">
          Information according to § 5 TMG / § 18 MStV:
        </p>
        <p className="mt-2">
          Kenvara Solivo Lwie
          <br />
          52064 Aachen
        </p>
        <p className="mt-3 font-medium text-charcoal/70">Contact:</p>
        <p className="mt-2">
          Email:{" "}
          <a href="mailto:kenvara.solivo@gmail.com" className="focus-ring rounded-sm text-cobalt hover:underline">
            kenvara.solivo@gmail.com
          </a>
        </p>
        <p className="mt-4 text-charcoal/45">
          Note: This website is a private, non-commercial portfolio created solely for the
          purpose of showcasing my projects to prospective employers and recruiters.
        </p>
      </div>
    </details>
  );
}

export default function LandingPage({ navigate, onOpenAuth }: LandingPageProps) {
  const { session, continueAsGuest, signOut } = useAuth();
  const isSignedIn = Boolean(session);

  const time = useLocalTime();
  const [menuOpen, setMenuOpen] = useState(false);

  const features = useReveal<HTMLDivElement>();
  const steps = useReveal<HTMLDivElement>();
  const ctaBand = useReveal<HTMLDivElement>();

  const enterApp = () => navigate("/app");
  const ctaLabel = isSignedIn ? "Open ALIGN" : "Try ALIGN";

  const handleGuest = () => {
    continueAsGuest();
    navigate("/app");
  };

  const scrollToId = (href: string) => {
    if (!href.startsWith("#")) {
      window.location.href = href;
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(href.slice(1))?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Hero (full viewport) ───────────────────────────────────── */}
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-surface [min-height:100svh]">
        <HeroBackdrop />

        {/* Pill navbar */}
        <div className="relative z-20 mx-auto w-full max-w-[1440px] p-2 sm:p-3">
          <nav className="flex items-center justify-between rounded-full border border-hairline bg-panel/80 p-[5px] shadow-card backdrop-blur-md">
            {/* Left: brand + links */}
            <div className="flex items-center gap-3 sm:gap-5">
              <a
                href="/"
                onClick={(event) => {
                  event.preventDefault();
                  window.scrollTo({ top: 0 });
                }}
                className="focus-ring flex items-center gap-2 rounded-full pl-1.5 pr-1 select-none"
                aria-label="ALIGN home"
              >
                <LogoMark className="h-8 w-8 sm:h-9 sm:w-9" />
                <span className="text-base font-extrabold tracking-tight text-obsidian">ALIGN</span>
              </a>
              <div className="hidden items-center gap-6 md:flex">
                {NAV_LINKS.map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    onClick={(event) => {
                      if (href.startsWith("#")) {
                        event.preventDefault();
                        scrollToId(href);
                      }
                    }}
                    className="focus-ring rounded text-sm text-charcoal/80 transition-colors duration-300 hover:text-obsidian"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Right: status + clock + account */}
            <div className="hidden items-center gap-2 md:flex">
              <span className="hidden text-[13px] text-charcoal/55 lg:inline">
                Tailoring applications for 2026
              </span>
              <span className="hidden items-center gap-1.5 text-[13px] text-charcoal/60 lg:flex">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                {time} in Aachen
              </span>
              <ThemeToggle className="h-9 w-9 rounded-full" />
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="focus-ring rounded-full px-3 py-2 text-[13px] font-medium text-charcoal/75 transition-colors duration-200 hover:text-obsidian"
                >
                  Log out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuth("signin")}
                  className="focus-ring rounded-full px-3 py-2 text-[13px] font-medium text-charcoal/75 transition-colors duration-200 hover:text-obsidian"
                >
                  Log in
                </button>
              )}
              <RollCta label={ctaLabel} onClick={enterApp} />
            </div>

            {/* Mobile toggle */}
            <div className="flex items-center gap-1.5 md:hidden">
              <ThemeToggle className="h-9 w-9 rounded-full" />
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-obsidian px-3.5 py-2 text-[13px] font-medium text-surface"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" strokeWidth={2} />
                Menu
              </button>
            </div>
          </nav>
        </div>

        {/* Hero content — pinned to the top-left of the viewport */}
        <div className="relative z-20 flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-[1440px] px-5 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
            <p className="mb-5 text-[13px] tracking-wide text-charcoal/70 sm:mb-8 sm:text-sm">
              ALIGN · Professional alignment engine
            </p>
            <h1
              className="font-semibold leading-[1.06] tracking-[-0.03em] text-obsidian"
              style={{ fontSize: "clamp(1.6rem, 5vw, 3.4rem)" }}
            >
              See where you match any job,
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              which skills you’re missing,
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              and how to{" "}
              <span className="bg-gradient-to-r from-cobalt to-cobalt-hover bg-clip-text text-transparent">
                close the gap.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-charcoal/65 sm:text-base">
              A clear skill-alignment matrix, honest feedback on what’s missing, and an editable
              cover letter or cold email in EN or DE when you’re ready — nothing ships without your
              edit.
            </p>

            <div className="mt-8 flex flex-col items-start gap-4 sm:mt-10 sm:flex-row sm:items-center sm:gap-5">
              <RollCta label={ctaLabel} onClick={enterApp} className="text-sm" />

              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => scrollToId("#features")}
                  className="focus-ring rounded-full border border-hairline bg-panel/70 px-5 py-2.5 text-[13px] font-medium text-charcoal/80 shadow-xs backdrop-blur-sm transition-colors duration-200 hover:text-obsidian sm:text-sm"
                >
                  See features
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuth("signup")}
                  className="focus-ring rounded-full border border-hairline bg-panel/70 px-5 py-2.5 text-[13px] font-medium text-charcoal/80 shadow-xs backdrop-blur-sm transition-colors duration-200 hover:text-obsidian sm:text-sm"
                >
                  Register
                </button>
              )}

              {/* Feature badge — repurposed Axion "certified partner" pill */}
              <div className="flex items-center gap-2 rounded-[6px] bg-panel/85 px-3 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-sm">
                <svg viewBox="0 0 100 100" className="h-5 w-5 fill-current text-cobalt sm:h-6 sm:w-6" aria-hidden="true">
                  <path d={STARBURST_PATH} />
                </svg>
                <span className="text-[13px] font-medium text-obsidian sm:text-sm">English &amp; German</span>
                <span className="rounded bg-obsidian px-1.5 py-0.5 text-[10px] font-semibold text-surface sm:px-2 sm:text-[11px]">
                  EN·DE
                </span>
              </div>
            </div>

            {!isSignedIn && (
              <button
                type="button"
                onClick={handleGuest}
                className="focus-ring mt-6 rounded-md px-1 text-[13px] font-medium text-charcoal/55 transition-colors duration-150 hover:text-cobalt"
              >
                Continue as guest — nothing is saved →
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div
            className="absolute inset-x-3 bottom-3 rounded-2xl border border-hairline bg-panel p-5 shadow-lift"
            style={{ animation: "fade-in-up 350ms cubic-bezier(0.16,1,0.3,1) both" }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] text-charcoal/60">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                {time} in Aachen
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full bg-obsidian text-surface"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-4">
              {NAV_LINKS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  onClick={(event) => {
                    if (href.startsWith("#")) {
                      event.preventDefault();
                      scrollToId(href);
                    }
                    setMenuOpen(false);
                  }}
                  className="text-2xl font-medium text-obsidian"
                >
                  {label}
                </a>
              ))}
            </nav>

            <div className="mt-7 flex flex-col gap-2.5">
              <RollCta
                label={ctaLabel}
                onClick={() => {
                  setMenuOpen(false);
                  enterApp();
                }}
                className="w-full justify-between"
              />
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                  className="focus-ring rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-charcoal/80"
                >
                  Log out
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenAuth("signup");
                    }}
                    className="focus-ring rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-charcoal/80"
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenAuth("signin");
                    }}
                    className="focus-ring rounded-full px-4 py-2 text-sm font-medium text-charcoal/60"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Product showcase ───────────────────────────────────────── */}
      <section className="relative px-4 pb-10 pt-24 sm:px-6 sm:pb-14 sm:pt-32">
        <div className="mx-auto max-w-4xl">
          <p className="label-caps mb-7 text-center">A peek inside the workspace</p>
          <div className="relative">
            {/* Soft cobalt halo echoing the hero's accent */}
            <div
              aria-hidden="true"
              className="absolute -inset-x-8 -top-8 bottom-8 -z-10 rounded-[2.5rem] bg-cobalt/10 blur-3xl"
            />
            <ProductVisual />
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24">
        <div ref={features.ref} className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="label-caps">Everything you need</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-obsidian sm:text-4xl">
              From job posting to polished draft
            </h2>
            <p className="mt-4 text-base leading-relaxed text-charcoal/60">
              One workspace that analyzes, remembers, and improves with every application you run.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ title, description, icon }, index) => (
              <div
                key={title}
                className={`card p-6 transition-all duration-500 ease-out-quart ${
                  features.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: features.visible ? `${index * 70}ms` : undefined }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt [&>svg]:h-5 [&>svg]:w-5">
                  {icon}
                </span>
                <h3 className="mt-4 text-base font-semibold text-obsidian">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-charcoal/60">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section id="how" className="scroll-mt-24 border-y border-hairline bg-panel px-4 py-16 sm:px-6 sm:py-20">
        <div ref={steps.ref} className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="label-caps">How it works</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-obsidian sm:text-3xl">
              Three steps to a stronger application
            </h2>
          </div>

          <ol className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            {STEPS.map(({ title, description }, index) => (
              <li
                key={title}
                className={`relative transition-all duration-500 ease-out-quart ${
                  steps.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
                style={{ transitionDelay: steps.visible ? `${index * 100}ms` : undefined }}
              >
                {/* Connector line between steps on desktop */}
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[calc(50%+28px)] top-5 hidden h-px w-[calc(100%-56px)] bg-hairline sm:block"
                  />
                )}
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-cobalt-100 bg-cobalt-50 text-sm font-bold text-cobalt">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-obsidian">{title}</h3>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-charcoal/60">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="px-4 py-20 sm:px-6 sm:py-24">
        <div
          ref={ctaBand.ref}
          className={`relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-cobalt-100 bg-gradient-to-b from-cobalt-50 to-panel px-6 py-14 text-center shadow-card transition-all duration-500 ease-out-quart sm:px-12 ${
            ctaBand.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_-20%,rgb(0_82_255_/_0.10),transparent)]"
          />
          <div className="relative flex flex-col items-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-obsidian sm:text-3xl">
              Your next application, perfectly aligned.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base text-charcoal/60">
              Run your first analysis in under a minute — no setup required.
            </p>
            <div className="mt-8">
              <RollCta label={ctaLabel} onClick={enterApp} className="text-sm" />
            </div>
            {!isSignedIn && (
              <button
                type="button"
                onClick={handleGuest}
                className="focus-ring mt-5 rounded-md px-1 text-sm font-medium text-charcoal/55 transition-colors duration-150 hover:text-cobalt"
              >
                Continue as guest — nothing is saved →
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-hairline bg-panel px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-2.5 select-none">
            <LogoMark className="h-6 w-6" />
            <span className="text-base font-extrabold tracking-tight text-obsidian">ALIGN</span>
          </div>
          <p className="max-w-sm text-sm text-charcoal/50">
            The AI-driven professional alignment engine — match your resume to any job and draft
            the application in EN or DE.
          </p>
          <ImpressumDetails />
          <p className="text-xs text-charcoal/35">
            © {new Date().getFullYear()} ALIGN — a private, non-commercial portfolio project.
          </p>
        </div>
      </footer>
    </div>
  );
}
