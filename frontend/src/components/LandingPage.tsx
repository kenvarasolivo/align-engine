import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LogoMark } from "./Logo";
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

/** Abstract JSX mockup of the ALIGN workspace — stands in for a screenshot. */
function ProductVisual() {
  return (
    <div
      className="card overflow-hidden rounded-2xl shadow-lift motion-safe:animate-float select-none"
      aria-hidden="true"
    >
      {/* Faux app header */}
      <div className="flex h-11 items-center justify-between border-b border-hairline bg-white px-4">
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
      <div className="mt-4 rounded-2xl border border-hairline bg-white/70 p-5 text-xs leading-relaxed text-charcoal/60 shadow-xs backdrop-blur-sm">
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

  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = useReveal<HTMLDivElement>();
  const steps = useReveal<HTMLDivElement>();
  const ctaBand = useReveal<HTMLDivElement>();

  const enterApp = () => navigate("/app");

  const scrollToFeatures = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("features")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };

  const handleGuest = () => {
    continueAsGuest();
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Sticky nav ─────────────────────────────────────────────── */}
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ease-out-quart ${
          scrolled ? "border-b border-hairline bg-white/85 shadow-xs backdrop-blur-md" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0 });
            }}
            className="focus-ring flex items-center gap-2.5 rounded-lg select-none"
            aria-label="ALIGN home"
          >
            <LogoMark className="h-7 w-7" />
            <span className="text-lg font-extrabold tracking-tight text-obsidian">ALIGN</span>
          </a>

          {isSignedIn ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="btn-secondary h-9 px-4 text-sm"
            >
              Log out
            </button>
          ) : (
            <nav className="flex items-center gap-2" aria-label="Account">
              <button
                type="button"
                onClick={() => onOpenAuth("signin")}
                className="btn-secondary h-9 px-4 text-sm"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth("signup")}
                className="btn-primary h-9 px-4 text-sm"
              >
                Register
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 sm:pt-36">
        {/* Ambient backdrop: dot grid fading out + soft cobalt glow + slow drift */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_35%,black_15%,transparent_100%)] opacity-50"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_-12%,rgb(0_82_255_/_0.12),transparent)]"
        />
        <div
          aria-hidden="true"
          className="absolute left-[12%] top-[18%] h-72 w-72 rounded-full bg-cobalt/[0.06] blur-3xl motion-safe:animate-drift"
        />
        <div
          aria-hidden="true"
          className="absolute right-[10%] top-[40%] h-80 w-80 rounded-full bg-cobalt-200/20 blur-3xl motion-safe:animate-drift [animation-delay:-8s]"
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cobalt-100 bg-cobalt-50 px-3 py-1 text-2xs font-semibold text-cobalt animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-cobalt" aria-hidden="true" />
            AI-powered job alignment
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-obsidian sm:text-5xl lg:text-6xl animate-fade-in-up">
            Tailor your application to any job —{" "}
            <span className="bg-gradient-to-r from-cobalt to-[#3B82F6] bg-clip-text text-transparent">
              in seconds
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-charcoal/65 sm:text-lg animate-fade-in-up [animation-delay:80ms]">
            ALIGN reads a job description against your resume, shows exactly where you match and
            where you don't, and drafts an editable cover letter or cold email in English or
            German. You stay in the loop — nothing ships without your edit.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-in-up [animation-delay:160ms]">
            <button
              type="button"
              onClick={enterApp}
              className="btn-primary h-12 px-8 text-base shadow-cta transition-all duration-200 ease-out-quart hover:-translate-y-px hover:shadow-cta-lg active:translate-y-0 active:shadow-cta"
            >
              {isSignedIn ? "Open ALIGN" : "Try ALIGN"}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
            {isSignedIn ? (
              <button type="button" onClick={scrollToFeatures} className="btn-secondary h-12 px-7 text-base">
                See features
              </button>
            ) : (
              <button type="button" onClick={() => onOpenAuth("signup")} className="btn-secondary h-12 px-7 text-base">
                Register
              </button>
            )}
          </div>
        </div>

        {/* Product visual */}
        <div className="relative mx-auto mt-16 max-w-4xl animate-fade-in-up [animation-delay:260ms]">
          <ProductVisual />
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24">
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
      <section className="border-y border-hairline bg-white px-4 py-16 sm:px-6 sm:py-20">
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
          className={`relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-cobalt-100 bg-gradient-to-b from-cobalt-50 to-white px-6 py-14 text-center shadow-card transition-all duration-500 ease-out-quart sm:px-12 ${
            ctaBand.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_-20%,rgb(0_82_255_/_0.10),transparent)]"
          />
          <div className="relative">
            <h2 className="text-2xl font-extrabold tracking-tight text-obsidian sm:text-3xl">
              Your next application, perfectly aligned.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base text-charcoal/60">
              Run your first analysis in under a minute — no setup required.
            </p>
            <div className="mt-8">
              <button
                type="button"
                onClick={enterApp}
                className="btn-primary h-12 px-8 text-base shadow-cta transition-all duration-200 ease-out-quart hover:-translate-y-px hover:shadow-cta-lg active:translate-y-0 active:shadow-cta"
              >
                {isSignedIn ? "Open ALIGN" : "Try ALIGN"}
              </button>
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
      <footer className="border-t border-hairline bg-white px-4 py-12 sm:px-6">
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
