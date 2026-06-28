import { useEffect, useMemo, useState } from "react";
import type { Language, RetrievedSkill, SkillCoachResult } from "../types";

interface SkillCoachProps {
  gaps: string[];
  language: Language;
  resumeText: string;
  jobDescriptionText: string;
}

const STRINGS: Record<
  Language,
  {
    title: string;
    blurb: string;
    cta: string;
    loading: string;
    retry: string;
    grounded: string;
    sourceLabel: string;
    resourcesLabel: string;
    unavailable: string;
    noPlan: string;
    errorPrefix: string;
  }
> = {
  en: {
    title: "Skill Coach",
    blurb: "Get a grounded learning plan for your gaps — retrieved from a curated knowledge base, not invented.",
    cta: "Generate learning plan",
    loading: "Retrieving knowledge & drafting your plan…",
    retry: "Regenerate",
    grounded: "Grounded in retrieval",
    sourceLabel: "Source",
    resourcesLabel: "Learn",
    unavailable:
      "The knowledge base isn’t available right now, so no grounded plan could be generated.",
    noPlan:
      "Couldn’t ground a plan for these specific gaps from the knowledge base. Try Regenerate.",
    errorPrefix: "Couldn’t generate a plan",
  },
  de: {
    title: "Skill-Coach",
    blurb: "Erhalten Sie einen fundierten Lernplan für Ihre Lücken — abgerufen aus einer kuratierten Wissensdatenbank, nicht erfunden.",
    cta: "Lernplan erstellen",
    loading: "Wissen wird abgerufen & Plan wird erstellt…",
    retry: "Neu generieren",
    grounded: "Durch Retrieval fundiert",
    sourceLabel: "Quelle",
    resourcesLabel: "Lernen",
    unavailable:
      "Die Wissensdatenbank ist derzeit nicht verfügbar, daher konnte kein fundierter Plan erstellt werden.",
    noPlan:
      "Für diese spezifischen Lücken konnte aus der Wissensdatenbank kein Plan abgeleitet werden. Bitte erneut generieren.",
    errorPrefix: "Plan konnte nicht erstellt werden",
  },
};

type Status = "idle" | "loading" | "done" | "error";

export default function SkillCoach({ gaps, language, resumeText, jobDescriptionText }: SkillCoachProps) {
  const t = STRINGS[language];
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<SkillCoachResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A new analysis (new gaps) invalidates any previous plan.
  const gapKey = gaps.join("|");
  useEffect(() => {
    setStatus("idle");
    setData(null);
    setError(null);
  }, [gapKey]);

  // Resolve a cited source_slug back to its retrieved card (name + similarity).
  const sourcesBySlug = useMemo(() => {
    const map = new Map<string, RetrievedSkill>();
    data?.sources.forEach((s) => map.set(s.slug, s));
    return map;
  }, [data]);

  const generate = async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/skill-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill_gaps: gaps,
          language,
          resume_text: resumeText || undefined,
          job_description_text: jobDescriptionText || undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
      }
      const result: SkillCoachResult = await response.json();
      setData(result);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error — please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="rounded-xl border border-cobalt-100 bg-cobalt-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-cobalt">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            {t.title}
          </h2>
          {status !== "done" && (
            <p className="mt-1 text-xs leading-relaxed text-charcoal/65">{t.blurb}</p>
          )}
        </div>
        {(status === "idle" || status === "error" || status === "done") && (
          <button
            type="button"
            onClick={generate}
            className="focus-ring shrink-0 rounded-lg bg-cobalt px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cobalt/90"
          >
            {status === "done" ? t.retry : t.cta}
          </button>
        )}
      </div>

      {status === "loading" && (
        <div className="mt-3 flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-cobalt animate-pulse" aria-hidden="true" />
          <p className="text-xs font-medium text-cobalt">{t.loading}</p>
        </div>
      )}

      {status === "error" && (
        <p className="mt-3 text-xs text-warning-strong">
          {t.errorPrefix}: {error}
        </p>
      )}

      {status === "done" && data && (
        <div className="mt-3 animate-fade-in-up">
          {!data.grounded ? (
            <p className="text-xs leading-relaxed text-charcoal/70">{t.unavailable}</p>
          ) : data.items.length === 0 ? (
            <p className="text-xs leading-relaxed text-charcoal/70">{t.noPlan}</p>
          ) : (
            <>
              <p className="text-xs font-medium leading-relaxed text-charcoal/80">{data.summary}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cobalt-100/70 px-2 py-0.5 text-2xs font-semibold text-cobalt">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {t.grounded}
              </div>
              <ul className="mt-3 space-y-2.5">
                {data.items.map((item, i) => {
                  const itemSources = item.source_slugs
                    .map((slug) => sourcesBySlug.get(slug))
                    .filter((s): s is RetrievedSkill => Boolean(s));
                  // Real, curated links from the cited cards — surfaced verbatim
                  // (never model-generated), deduped by URL across cards.
                  const itemResources = Array.from(
                    new Map(
                      itemSources
                        .flatMap((s) => s.resources ?? [])
                        .map((r) => [r.url, r] as const),
                    ).values(),
                  );
                  return (
                    <li key={`${item.source_slugs.join("-")}-${i}`} className="rounded-lg border border-hairline bg-panel px-3.5 py-2.5 shadow-xs">
                      <div className="text-sm font-semibold text-obsidian">{item.gap}</div>
                      <p className="mt-1 text-xs leading-relaxed text-charcoal/75">{item.guidance}</p>
                      {itemSources.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-charcoal/50">
                          <span className="inline-flex items-center gap-1.5 font-medium text-charcoal/60">
                            <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                            </svg>
                            {t.sourceLabel}:
                          </span>
                          {itemSources.map((source) => (
                            <span key={source.slug} className="inline-flex items-center gap-1">
                              <span>{source.name}</span>
                              <span className="tabular-nums text-cobalt/70">{Math.round(source.similarity * 100)}%</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {itemResources.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-charcoal/50">
                          <span className="inline-flex items-center gap-1.5 font-medium text-charcoal/60">
                            <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                              <path d="M15 3h6v6" />
                              <path d="M10 14L21 3" />
                            </svg>
                            {t.resourcesLabel}:
                          </span>
                          {itemResources.map((resource) => (
                            <a
                              key={resource.url}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="focus-ring inline-flex items-center gap-1 rounded text-cobalt underline decoration-cobalt/30 underline-offset-2 transition-colors hover:text-cobalt/80 hover:decoration-cobalt/60"
                            >
                              {resource.title}
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
