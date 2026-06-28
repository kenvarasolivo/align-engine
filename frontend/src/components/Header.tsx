import { LogoMark } from "./Logo";
import ThemeToggle from "./ThemeToggle";
import type { Language, Mode, UsageInfo, View } from "../types";

interface HeaderProps {
  view: View;
  onViewChange: (view: View) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  /** Null while browsing as guest. */
  userEmail: string | null;
  usage: UsageInfo | null;
  onSignOut: () => void;
  onGoToLogin: () => void;
  /** Returns to the marketing landing page. */
  onLogoClick: () => void;
}

const MODES: { value: Mode; label: string }[] = [
  { value: "anschreiben", label: "Anschreiben" },
  { value: "email", label: "Email Outreach" },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "de", label: "DE" },
];

const NAV: Record<Language, { value: View; label: string }[]> = {
  en: [
    { value: "workspace", label: "Workspace" },
    { value: "history", label: "History" },
    { value: "vault", label: "Resumes" },
    { value: "jobs", label: "Jobs" },
    { value: "insights", label: "Insights" },
  ],
  de: [
    { value: "workspace", label: "Workspace" },
    { value: "history", label: "Verlauf" },
    { value: "vault", label: "Lebensläufe" },
    { value: "jobs", label: "Jobs" },
    { value: "insights", label: "Insights" },
  ],
};

export default function Header({
  view,
  onViewChange,
  mode,
  onModeChange,
  language,
  onLanguageChange,
  userEmail,
  usage,
  onSignOut,
  onGoToLogin,
  onLogoClick,
}: HeaderProps) {
  const isSignedIn = userEmail !== null;
  const quotaRatio = usage ? usage.used_today / Math.max(usage.daily_limit, 1) : 0;

  return (
    <header className="h-16 shrink-0 flex items-center justify-between gap-4 px-4 lg:px-6 bg-panel border-b border-hairline">
      <div className="flex items-center gap-3 lg:gap-6 min-w-0">
        {/* Brand — returns to the landing page */}
        <button
          type="button"
          onClick={onLogoClick}
          aria-label="Back to the ALIGN landing page"
          className="focus-ring flex items-center gap-2.5 rounded-lg select-none shrink-0"
        >
          <LogoMark className="h-7 w-7" />
          <h1 className="text-lg font-extrabold tracking-tight text-obsidian">ALIGN</h1>
        </button>

        {/* Saved-data sections only exist for signed-in users */}
        {isSignedIn && (
          <nav className="flex items-center gap-0.5 overflow-x-auto" aria-label="Primary">
            {NAV[language].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onViewChange(value)}
                aria-current={view === value ? "page" : undefined}
                className={`focus-ring whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                  view === value
                    ? "bg-cobalt-50 text-cobalt"
                    : "text-charcoal/55 hover:text-obsidian hover:bg-surface-sunken"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-2.5 lg:gap-3 shrink-0">
        {/* Daily quota chip with depletion bar */}
        {usage && (
          <span
            className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-full border border-hairline bg-panel shadow-xs"
            title={language === "de" ? "Analysen heute" : "Analyses today"}
          >
            <span className="h-1.5 w-12 rounded-full bg-surface-sunken overflow-hidden" aria-hidden="true">
              <span
                className={`block h-full rounded-full transition-all duration-300 ease-out-quart ${
                  quotaRatio >= 1 ? "bg-danger" : quotaRatio >= 0.8 ? "bg-warning" : "bg-cobalt"
                }`}
                style={{ width: `${Math.min(100, quotaRatio * 100)}%` }}
              />
            </span>
            <span className="text-2xs font-semibold tabular-nums text-charcoal/70">
              {usage.used_today}/{usage.daily_limit}
            </span>
          </span>
        )}

        {/* Mode selector — only relevant in the workspace */}
        {view === "workspace" && (
          <div className="flex items-center p-0.5 rounded-lg border border-hairline bg-surface-sunken/70" role="group">
            {MODES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                aria-pressed={mode === value}
                className={`focus-ring whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
                  mode === value
                    ? "bg-panel text-cobalt shadow-xs ring-1 ring-black/[0.04]"
                    : "text-charcoal/60 hover:text-obsidian"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Language toggle */}
        <div className="flex items-center p-0.5 rounded-lg border border-hairline bg-surface-sunken/70" role="group">
          {LANGUAGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onLanguageChange(value)}
              aria-pressed={language === value}
              className={`focus-ring px-2.5 py-1.5 text-sm font-semibold rounded-md transition-all duration-150 ${
                language === value
                  ? "bg-panel text-cobalt shadow-xs ring-1 ring-black/[0.04]"
                  : "text-charcoal/60 hover:text-obsidian"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Dark / light theme toggle */}
        <ThemeToggle />

        {/* Auth status */}
        {isSignedIn ? (
          <div className="flex items-center gap-2.5 pl-3 border-l border-hairline">
            <span
              className="hidden md:flex h-7 w-7 items-center justify-center rounded-full bg-cobalt-50 text-2xs font-bold uppercase text-cobalt select-none"
              aria-hidden="true"
            >
              {userEmail.charAt(0)}
            </span>
            <span className="hidden md:inline text-xs text-charcoal/50 truncate max-w-[150px]" title={userEmail}>
              {userEmail}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="focus-ring px-2.5 py-1.5 text-xs font-medium rounded-lg border border-hairline bg-panel text-charcoal/70 shadow-xs transition-all duration-150 hover:text-danger hover:border-danger-border"
            >
              {language === "de" ? "Abmelden" : "Sign out"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 pl-3 border-l border-hairline">
            <span className="hidden md:inline text-xs text-charcoal/40">
              {language === "de" ? "Gast — nichts wird gespeichert" : "Guest — nothing is saved"}
            </span>
            <button
              type="button"
              onClick={onGoToLogin}
              className="btn-primary px-3.5 py-1.5 text-xs shadow-xs"
            >
              {language === "de" ? "Anmelden" : "Sign in"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
