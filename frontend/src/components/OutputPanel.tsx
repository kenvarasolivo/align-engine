import type { AnalysisResult, Language, OutputTab } from "../App";

interface OutputPanelProps {
  language: Language;
  result: AnalysisResult | null;
  draft: string;
  onDraftChange: (value: string) => void;
  activeTab: OutputTab;
  onTabChange: (tab: OutputTab) => void;
  isLoading: boolean;
}

const STRINGS: Record<
  Language,
  {
    analysisTab: string;
    draftTab: string;
    matchingSkills: string;
    skillGaps: string;
    empty: string;
    loading: string;
    draftEmpty: string;
  }
> = {
  en: {
    analysisTab: "Semantic Analysis",
    draftTab: "Draft Editor",
    matchingSkills: "Matching Skills",
    skillGaps: "Skill Gaps",
    empty: "Run an alignment analysis to populate this panel.",
    loading: "Aligning your profile against the role…",
    draftEmpty: "Your generated draft will appear here, ready to edit.",
  },
  de: {
    analysisTab: "Semantische Analyse",
    draftTab: "Entwurfseditor",
    matchingSkills: "Übereinstimmende Kompetenzen",
    skillGaps: "Kompetenzlücken",
    empty: "Starten Sie eine Analyse, um dieses Panel zu füllen.",
    loading: "Profil wird mit der Stelle abgeglichen…",
    draftEmpty: "Ihr generierter Entwurf erscheint hier und kann direkt bearbeitet werden.",
  },
};

export default function OutputPanel({
  language,
  result,
  draft,
  onDraftChange,
  activeTab,
  onTabChange,
  isLoading,
}: OutputPanelProps) {
  const t = STRINGS[language];

  const tabs: { value: OutputTab; label: string }[] = [
    { value: "analysis", label: t.analysisTab },
    { value: "draft", label: t.draftTab },
  ];

  return (
    <section className="flex flex-col h-full overflow-hidden bg-surface">
      {/* Tab bar */}
      <div className="flex items-end gap-1 px-6 bg-white border-b-[1px] border-hairline">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onTabChange(value)}
            className={`px-3 py-3 -mb-px text-sm font-medium border-b-2 transition-all duration-200 ${
              activeTab === value
                ? "border-cobalt text-cobalt"
                : "border-transparent text-charcoal/60 hover:text-obsidian"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "analysis" ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm font-medium text-cobalt animate-pulse">{t.loading}</p>
            </div>
          ) : result ? (
            <div className="space-y-8">
              <div>
                <h2 className="text-sm font-semibold text-obsidian mb-3">{t.matchingSkills}</h2>
                <div className="flex flex-wrap gap-2">
                  {result.matching_skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-charcoal bg-white rounded-lg border-[1px] border-hairline shadow-sm transition-all duration-200 hover:shadow"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-obsidian mb-3">{t.skillGaps}</h2>
                <ul className="space-y-2">
                  {result.skill_gaps.map((gap) => (
                    <li key={gap} className="flex items-start gap-2.5 text-sm text-charcoal">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-charcoal/40" />
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-charcoal/40">{t.empty}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-white">
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={t.draftEmpty}
            spellCheck={false}
            className="flex-1 w-full min-h-0 px-8 py-6 text-sm leading-relaxed text-charcoal bg-transparent border-none outline-none placeholder:text-charcoal/30"
          />
        </div>
      )}
    </section>
  );
}
