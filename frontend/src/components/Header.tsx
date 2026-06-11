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
}: HeaderProps) {
  const isSignedIn = userEmail !== null;

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b-[1px] border-hairline">
      <div className="flex items-center gap-6 min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-obsidian select-none shrink-0">ALIGN</h1>

        {/* Saved-data sections only exist for signed-in users */}
        {isSignedIn && (
          <nav className="flex items-center gap-1">
            {NAV[language].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onViewChange(value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  view === value ? "bg-cobalt/10 text-cobalt" : "text-charcoal/60 hover:text-obsidian"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Daily quota chip */}
        {usage && (
          <span
            className="hidden lg:inline-flex items-center px-2.5 py-1 text-[11px] font-medium rounded-full border-[1px] border-hairline bg-surface text-charcoal"
            title={language === "de" ? "Analysen heute" : "Analyses today"}
          >
            {usage.used_today}/{usage.daily_limit}
          </span>
        )}

        {/* Mode selector — only relevant in the workspace */}
        {view === "workspace" && (
          <div className="flex items-center p-0.5 rounded-lg border-[1px] border-hairline bg-surface">
            {MODES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  mode === value ? "bg-white text-cobalt shadow-sm" : "text-charcoal/70 hover:text-obsidian"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Language toggle */}
        <div className="flex items-center p-0.5 rounded-lg border-[1px] border-hairline bg-surface">
          {LANGUAGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onLanguageChange(value)}
              className={`px-2.5 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ${
                language === value ? "bg-white text-cobalt shadow-sm" : "text-charcoal/70 hover:text-obsidian"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Auth status */}
        {isSignedIn ? (
          <div className="flex items-center gap-2 pl-3 border-l-[1px] border-hairline">
            <span className="hidden md:inline text-xs text-charcoal/50 truncate max-w-[160px]" title={userEmail}>
              {userEmail}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border-[1px] border-hairline bg-white text-charcoal/70 transition-all duration-200 hover:text-red-600 hover:border-red-200"
            >
              {language === "de" ? "Abmelden" : "Sign out"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-3 border-l-[1px] border-hairline">
            <span className="hidden md:inline text-xs text-charcoal/40">
              {language === "de" ? "Gast — nichts wird gespeichert" : "Guest — nothing is saved"}
            </span>
            <button
              type="button"
              onClick={onGoToLogin}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-cobalt text-white transition-all duration-200 hover:bg-cobalt-hover"
            >
              {language === "de" ? "Anmelden" : "Sign in"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
