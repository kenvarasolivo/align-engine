import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LogoMark } from "./Logo";

export type AuthMode = "signin" | "signup";

interface LoginPageProps {
  /** Which tab to open on — "signup" when arriving via the landing page's Register. */
  initialMode?: AuthMode;
}

export default function LoginPage({ initialMode = "signin" }: LoginPageProps) {
  const { signIn, signUp, continueAsGuest } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (authMode === "signin") {
        const message = await signIn(email, password);
        if (message) setError(message);
      } else {
        const { error: message, needsConfirmation } = await signUp(email, password);
        if (message) {
          setError(message);
        } else if (needsConfirmation) {
          setNotice("Almost there — check your inbox and confirm your email, then sign in.");
          setAuthMode("signin");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-surface px-4 py-12">
      {/* Ambient backdrop: dot grid fading out + soft cobalt glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black_20%,transparent_100%)] opacity-50"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_-10%,rgb(0_82_255_/_0.10),transparent)]"
      />

      <div className="relative w-full max-w-sm animate-fade-in-up">
        {/* Brand */}
        <div className="text-center mb-8 select-none">
          <LogoMark className="mx-auto h-14 w-14" />
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-obsidian">ALIGN</h1>
          <p className="mt-2 text-sm leading-relaxed text-charcoal/55">
            Sign in to keep your analyses, resumes and saved jobs.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-hairline shadow-lift p-6">
          {/* Sign in / Sign up toggle */}
          <div className="flex items-center p-0.5 mb-6 rounded-lg border border-hairline bg-surface-sunken/70" role="group">
            {(
              [
                { value: "signin", label: "Sign in" },
                { value: "signup", label: "Create account" },
              ] as { value: AuthMode; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setAuthMode(value);
                  setError(null);
                  setNotice(null);
                }}
                aria-pressed={authMode === value}
                className={`focus-ring flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                  authMode === value
                    ? "bg-white text-cobalt shadow-xs ring-1 ring-black/[0.04]"
                    : "text-charcoal/60 hover:text-obsidian"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label-caps block mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full h-11 px-3.5 text-sm rounded-lg border border-hairline bg-white text-charcoal shadow-xs outline-none transition-all duration-150 placeholder:text-charcoal/30 hover:border-hairline-strong focus:border-cobalt/60 focus:ring-4 focus:ring-cobalt/10"
              />
            </div>

            <div>
              <label htmlFor="password" className="label-caps block mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full h-11 px-3.5 text-sm rounded-lg border border-hairline bg-white text-charcoal shadow-xs outline-none transition-all duration-150 placeholder:text-charcoal/30 hover:border-hairline-strong focus:border-cobalt/60 focus:ring-4 focus:ring-cobalt/10"
              />
            </div>

            {error && (
              <div
                className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5 animate-fade-in"
                role="alert"
              >
                <svg className="mt-px h-3.5 w-3.5 shrink-0 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4m0 4h.01" />
                </svg>
                <p className="text-xs leading-snug text-danger-strong">{error}</p>
              </div>
            )}
            {notice && (
              <div className="flex items-start gap-2 rounded-lg border border-success-border bg-success-soft px-3 py-2.5 animate-fade-in">
                <svg className="mt-px h-3.5 w-3.5 shrink-0 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9 12.5l2 2 4-5" />
                </svg>
                <p className="text-xs leading-snug text-success-strong">{notice}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full h-11 text-sm shadow-cta hover:shadow-cta-lg hover:-translate-y-px active:translate-y-0 active:shadow-cta transition-all duration-200 ease-out-quart"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span>Please wait…</span>
                </>
              ) : authMode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>
          </form>
        </div>

        {/* Guest path */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={continueAsGuest}
            className="focus-ring rounded-md px-1 text-sm font-medium text-charcoal/60 hover:text-cobalt transition-colors duration-150"
          >
            Continue as guest →
          </button>
          <p className="mt-1.5 text-xs text-charcoal/40">
            Guest sessions work fully, but nothing is saved.
          </p>
        </div>

        {/* Impressum */}
        <details className="mt-8 text-left">
          <summary className="focus-ring cursor-pointer list-none rounded-md text-center text-xs font-medium text-charcoal/40 hover:text-cobalt transition-colors duration-150">
            Impressum
          </summary>
          <div className="mt-4 rounded-2xl border border-hairline bg-white/70 backdrop-blur-sm p-5 text-xs leading-relaxed text-charcoal/60 shadow-xs">
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
      </div>
    </div>
  );
}
