import type { Language, Mode } from "../App";

interface HeaderProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}

const MODES: { value: Mode; label: string }[] = [
  { value: "anschreiben", label: "Anschreiben" },
  { value: "email", label: "Email Outreach" },
];

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "de", label: "DE" },
];

export default function Header({ mode, onModeChange, language, onLanguageChange }: HeaderProps) {
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b-[1px] border-hairline">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-extrabold tracking-tight text-obsidian select-none">ALIGN</h1>
        <span className="hidden md:inline-flex items-center px-2.5 py-1 text-[11px] font-medium rounded-full border-[1px] border-hairline bg-surface text-charcoal">
          Human-in-the-Loop Engine
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Mode selector — segmented control */}
        <div className="flex items-center p-0.5 rounded-lg border-[1px] border-hairline bg-surface">
          {MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                mode === value
                  ? "bg-white text-cobalt shadow-sm"
                  : "text-charcoal/70 hover:text-obsidian"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Language toggle */}
        <div className="flex items-center p-0.5 rounded-lg border-[1px] border-hairline bg-surface">
          {LANGUAGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onLanguageChange(value)}
              className={`px-2.5 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 ${
                language === value
                  ? "bg-white text-cobalt shadow-sm"
                  : "text-charcoal/70 hover:text-obsidian"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
