import type { AnalysisResult, Language, OutputTab } from "../types";
import SkillCoach from "./SkillCoach";

interface OutputPanelProps {
  language: Language;
  result: AnalysisResult | null;
  draft: string;
  onDraftChange: (value: string) => void;
  activeTab: OutputTab;
  onTabChange: (tab: OutputTab) => void;
  isLoading: boolean;
  resumeText: string;
  jobDescriptionText: string;
}

const STRINGS: Record<
  Language,
  {
    analysisTab: string;
    draftTab: string;
    matchingSkills: string;
    evidenceLabel: string;
    skillGaps: string;
    emptyTitle: string;
    empty: string;
    loading: string;
    scoreLabel: string;
    matchedShort: string;
    gapsShort: string;
    draftEmpty: string;
    words: string;
  }
> = {
  en: {
    analysisTab: "Semantic Analysis",
    draftTab: "Draft Editor",
    matchingSkills: "Matching Skills",
    evidenceLabel: "From your resume:",
    skillGaps: "Skill Gaps",
    emptyTitle: "Ready to align",
    empty: "Run an alignment analysis to populate this panel.",
    loading: "Aligning your profile against the role…",
    scoreLabel: "Alignment score",
    matchedShort: "matched",
    gapsShort: "gaps",
    draftEmpty: "Your generated draft will appear here, ready to edit.",
    words: "words",
  },
  de: {
    analysisTab: "Semantische Analyse",
    draftTab: "Entwurfseditor",
    matchingSkills: "Übereinstimmende Kompetenzen",
    evidenceLabel: "Aus Ihrem Lebenslauf:",
    skillGaps: "Kompetenzlücken",
    emptyTitle: "Bereit zum Abgleich",
    empty: "Starten Sie eine Analyse, um dieses Panel zu füllen.",
    loading: "Profil wird mit der Stelle abgeglichen…",
    scoreLabel: "Übereinstimmung",
    matchedShort: "passend",
    gapsShort: "Lücken",
    draftEmpty: "Ihr generierter Entwurf erscheint hier und kann direkt bearbeitet werden.",
    words: "Wörter",
  },
};

/** Progress ring for the alignment score, color-banded by strength. */
function ScoreRing({ pct }: { pct: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const tone = pct >= 75 ? "text-success" : pct >= 45 ? "text-cobalt" : "text-warning";

  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-surface-sunken" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
          className={`${tone} transition-all duration-700 ease-out-quart`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold tabular-nums tracking-tight text-obsidian">
        {pct}%
      </span>
    </div>
  );
}

function AnalysisSkeleton({ label }: { label: string }) {
  return (
    <div className="p-5 lg:p-6 space-y-6 animate-fade-in" aria-busy="true">
      {/* Status line */}
      <div className="rounded-xl border border-hairline bg-panel p-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-cobalt animate-pulse" aria-hidden="true" />
          <p className="text-sm font-medium text-cobalt">{label}</p>
        </div>
        <div className="mt-3 h-1 rounded-full bg-cobalt-100 overflow-hidden" aria-hidden="true">
          <div className="h-full w-1/3 rounded-full bg-cobalt animate-indeterminate" />
        </div>
      </div>

      {/* Score placeholder */}
      <div className="flex items-center gap-5">
        <div className="skeleton h-20 w-20 rounded-full" />
        <div className="space-y-2.5 flex-1">
          <div className="skeleton h-3.5 w-28" />
          <div className="skeleton h-3 w-44" />
        </div>
      </div>

      {/* Matching skills placeholder */}
      <div>
        <div className="skeleton h-3 w-32 mb-3" />
        <div className="flex flex-wrap gap-2">
          {[72, 96, 56, 88, 64, 80].map((w, i) => (
            <div key={i} className="skeleton h-8 rounded-full" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* Gaps placeholder */}
      <div>
        <div className="skeleton h-3 w-24 mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-10 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OutputPanel({
  language,
  result,
  draft,
  onDraftChange,
  activeTab,
  onTabChange,
  isLoading,
  resumeText,
  jobDescriptionText,
}: OutputPanelProps) {
  const t = STRINGS[language];

  const tabs: { value: OutputTab; label: string }[] = [
    { value: "analysis", label: t.analysisTab },
    { value: "draft", label: t.draftTab },
  ];

  const scorePct = result ? Math.max(0, Math.min(100, Math.round(result.match_score ?? 0))) : 0;
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <section className="flex flex-col min-h-[560px] lg:min-h-0 lg:h-full overflow-hidden rounded-2xl border border-hairline bg-panel shadow-card">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-panel border-b border-hairline" role="tablist">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeTab === value}
            onClick={() => onTabChange(value)}
            className={`focus-ring px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 ${
              activeTab === value
                ? "bg-cobalt-50 text-cobalt"
                : "text-charcoal/55 hover:text-obsidian hover:bg-surface-sunken"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "analysis" ? (
        <div className="flex-1 min-h-0 overflow-y-auto bg-surface/40">
          {isLoading ? (
            <AnalysisSkeleton label={t.loading} />
          ) : result ? (
            <div className="p-5 lg:p-6 space-y-6 animate-fade-in-up">
              {/* Alignment score — the payoff */}
              <div className="flex items-center gap-5 rounded-xl border border-hairline bg-panel p-4 shadow-xs">
                <ScoreRing pct={scorePct} />
                <div className="min-w-0">
                  <p className="label-caps">{t.scoreLabel}</p>
                  {result.score_rationale && (
                    <p className="mt-1 text-sm leading-relaxed text-charcoal/75">{result.score_rationale}</p>
                  )}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-success-strong">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                      {result.matching_skills.length} {t.matchedShort}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-warning-strong">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
                      {result.skill_gaps.length} {t.gapsShort}
                    </span>
                  </p>
                </div>
              </div>

              {/* Matching skills — each grounded in a resume quote */}
              <div>
                <h2 className="label-caps mb-3">{t.matchingSkills}</h2>
                <ul className="space-y-2">
                  {result.matching_skills.map((match) => (
                    <li
                      key={match.skill}
                      className="rounded-lg border border-success-border bg-success-soft px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-success-strong">
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        {match.skill}
                      </div>
                      {match.evidence && (
                        <p className="mt-1.5 pl-5 text-xs leading-relaxed text-charcoal/70">
                          <span className="font-medium text-charcoal/45">{t.evidenceLabel} </span>
                          <span className="italic">“{match.evidence}”</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Skill gaps */}
              <div>
                <h2 className="label-caps mb-3">{t.skillGaps}</h2>
                <ul className="space-y-2">
                  {result.skill_gaps.map((gap) => (
                    <li
                      key={gap}
                      className="flex items-start gap-2.5 rounded-lg border border-warning-border/70 bg-warning-soft px-3.5 py-2.5 text-sm text-charcoal"
                    >
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 9v4m0 4h.01" />
                        <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                      </svg>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Skill Coach — RAG-grounded learning plan for the gaps above */}
              {result.skill_gaps.length > 0 && (
                <SkillCoach
                  gaps={result.skill_gaps}
                  language={language}
                  resumeText={resumeText}
                  jobDescriptionText={jobDescriptionText}
                />
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center px-8 text-center animate-fade-in">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cobalt-50 text-cobalt mb-4" aria-hidden="true">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="12" cy="12" r="0.5" fill="currentColor" />
                </svg>
              </span>
              <h3 className="text-sm font-semibold text-obsidian">{t.emptyTitle}</h3>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-charcoal/50">{t.empty}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-panel">
          <div className="flex items-center justify-between gap-3 px-5 lg:px-6 py-2 border-b border-hairline bg-surface/40">
            <span className="label-caps">{t.draftTab}</span>
            {wordCount > 0 && (
              <span className="text-2xs font-medium tabular-nums text-charcoal/40">
                {wordCount.toLocaleString(language === "de" ? "de-DE" : "en-US")} {t.words}
              </span>
            )}
          </div>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={t.draftEmpty}
            spellCheck={false}
            aria-label={t.draftTab}
            className="editor-surface flex-1 w-full min-h-0 px-6 lg:px-8 py-5 text-[11pt] leading-relaxed [font-family:Calibri,Carlito,'Segoe_UI',Arial,sans-serif] border-none outline-none"
          />
        </div>
      )}
    </section>
  );
}
