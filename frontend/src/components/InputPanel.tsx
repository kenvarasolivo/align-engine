import type { Language } from "../App";

interface InputPanelProps {
  language: Language;
  resumeText: string;
  onResumeChange: (value: string) => void;
  jobDescriptionText: string;
  onJobDescriptionChange: (value: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  error: string | null;
}

const STRINGS: Record<
  Language,
  {
    resumeLabel: string;
    resumePlaceholder: string;
    jobLabel: string;
    jobPlaceholder: string;
    analyze: string;
    analyzing: string;
  }
> = {
  en: {
    resumeLabel: "Resume",
    resumePlaceholder: "Paste your resume here…",
    jobLabel: "Job Description",
    jobPlaceholder: "Paste the job description here…",
    analyze: "Run Alignment Analysis",
    analyzing: "Analyzing…",
  },
  de: {
    resumeLabel: "Lebenslauf",
    resumePlaceholder: "Lebenslauf hier einfügen…",
    jobLabel: "Stellenbeschreibung",
    jobPlaceholder: "Stellenbeschreibung hier einfügen…",
    analyze: "Analyse starten",
    analyzing: "Analysiere…",
  },
};

export default function InputPanel({
  language,
  resumeText,
  onResumeChange,
  jobDescriptionText,
  onJobDescriptionChange,
  onAnalyze,
  isLoading,
  error,
}: InputPanelProps) {
  const t = STRINGS[language];
  const canSubmit = !isLoading && resumeText.trim().length > 0 && jobDescriptionText.trim().length > 0;

  return (
    <section className="flex flex-col h-full overflow-hidden bg-white border-r-[1px] border-hairline">
      {/* Top half — Resume */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-charcoal/50 select-none">
            {t.resumeLabel}
          </span>
        </div>
        <textarea
          value={resumeText}
          onChange={(event) => onResumeChange(event.target.value)}
          placeholder={t.resumePlaceholder}
          spellCheck={false}
          className="flex-1 w-full min-h-0 px-6 py-2 text-sm leading-relaxed text-charcoal bg-transparent border-none outline-none placeholder:text-charcoal/30"
        />
      </div>

      {/* Hairline divider */}
      <div className="border-t-[1px] border-hairline" />

      {/* Bottom half — Job Description */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-charcoal/50 select-none">
            {t.jobLabel}
          </span>
        </div>
        <textarea
          value={jobDescriptionText}
          onChange={(event) => onJobDescriptionChange(event.target.value)}
          placeholder={t.jobPlaceholder}
          spellCheck={false}
          className="flex-1 w-full min-h-0 px-6 py-2 text-sm leading-relaxed text-charcoal bg-transparent border-none outline-none placeholder:text-charcoal/30"
        />
      </div>

      {/* Action bar pinned to the bottom */}
      <div className="px-6 py-4 bg-surface border-t-[1px] border-hairline">
        {error && (
          <p className="mb-3 text-xs leading-snug text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canSubmit}
          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-cobalt text-white text-sm font-semibold transition-all duration-200 hover:bg-cobalt-hover active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              <span>{t.analyzing}</span>
            </>
          ) : (
            <span>{t.analyze}</span>
          )}
        </button>
      </div>
    </section>
  );
}
