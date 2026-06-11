import { useEffect, useMemo, useState } from "react";
import * as db from "../lib/db";
import type { AnalysisRow, Language, UsageRow } from "../types";

interface InsightsPageProps {
  language: Language;
}

// gemini-2.5-flash list pricing, USD per 1M tokens.
const INPUT_COST_PER_M = 0.3;
const OUTPUT_COST_PER_M = 2.5;

const TOP_N = 15;

interface SkillStat {
  label: string;
  count: number;
  /** Times the same skill appeared on the other list (strength <-> gap). */
  crossCount: number;
}

const STRINGS: Record<
  Language,
  {
    title: string;
    subtitle: string;
    loading: string;
    loadFailed: string;
    empty: string;
    totalAnalyses: string;
    runsToday: string;
    totalTokens: string;
    estCost: string;
    strengthsTitle: string;
    strengthsHint: string;
    gapsTitle: string;
    gapsHint: string;
    timesMatched: string;
    timesMissing: string;
    alsoGap: string;
    alsoStrength: string;
    noData: string;
  }
> = {
  en: {
    title: "Insights",
    subtitle: "Aggregated across all your analyses — what jobs keep asking for, what you already bring, and what your runs cost.",
    loading: "Crunching your analyses…",
    loadFailed: "Could not load your insights.",
    empty: "Run a few analyses first — insights appear once there is history to aggregate.",
    totalAnalyses: "Total analyses",
    runsToday: "Runs today",
    totalTokens: "Tokens used",
    estCost: "Est. Gemini cost",
    strengthsTitle: "Your most-matched skills",
    strengthsHint: "Skills that showed up in BOTH your resume and the job descriptions — your proven selling points.",
    gapsTitle: "Recurring gaps — learning roadmap",
    gapsHint: "Skills that jobs keep demanding but your resume doesn't credibly show yet. The higher the bar, the more it's worth closing.",
    timesMatched: "matched",
    timesMissing: "missing",
    alsoGap: "also a gap in some runs",
    alsoStrength: "already matched in some runs",
    noData: "Nothing here yet.",
  },
  de: {
    title: "Insights",
    subtitle: "Aggregiert über alle Ihre Analysen — was Stellen immer wieder verlangen, was Sie bereits mitbringen und was Ihre Läufe kosten.",
    loading: "Ihre Analysen werden ausgewertet…",
    loadFailed: "Die Insights konnten nicht geladen werden.",
    empty: "Führen Sie zuerst einige Analysen durch — Insights erscheinen, sobald es Verlauf zum Aggregieren gibt.",
    totalAnalyses: "Analysen gesamt",
    runsToday: "Läufe heute",
    totalTokens: "Verbrauchte Tokens",
    estCost: "Gesch. Gemini-Kosten",
    strengthsTitle: "Ihre am häufigsten passenden Kompetenzen",
    strengthsHint: "Kompetenzen, die SOWOHL im Lebenslauf ALS AUCH in den Stellenbeschreibungen auftauchten — Ihre belegten Stärken.",
    gapsTitle: "Wiederkehrende Lücken — Lern-Roadmap",
    gapsHint: "Kompetenzen, die Stellen immer wieder verlangen, Ihr Lebenslauf aber noch nicht glaubhaft zeigt. Je höher der Balken, desto lohnender das Schließen.",
    timesMatched: "passend",
    timesMissing: "fehlend",
    alsoGap: "in manchen Läufen auch eine Lücke",
    alsoStrength: "in manchen Läufen bereits passend",
    noData: "Noch keine Daten.",
  },
};

function aggregate(rows: AnalysisRow[], field: "matching_skills" | "skill_gaps"): Map<string, SkillStat> {
  const stats = new Map<string, SkillStat>();
  for (const row of rows) {
    for (const raw of row[field]) {
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      const existing = stats.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        stats.set(key, { label: raw.trim(), count: 1, crossCount: 0 });
      }
    }
  }
  return stats;
}

function SkillBars({
  stats,
  total,
  tone,
  countLabel,
  crossLabel,
  emptyLabel,
}: {
  stats: SkillStat[];
  total: number;
  tone: "emerald" | "amber";
  countLabel: string;
  crossLabel: string;
  emptyLabel: string;
}) {
  if (stats.length === 0) return <p className="text-sm text-charcoal/40">{emptyLabel}</p>;

  const max = stats[0].count;
  const barColor = tone === "emerald" ? "bg-emerald-500/80" : "bg-amber-500/80";
  const badgeColor =
    tone === "emerald" ? "text-amber-700 bg-amber-50 border-amber-100" : "text-emerald-700 bg-emerald-50 border-emerald-100";

  return (
    <ul className="space-y-3">
      {stats.map((stat) => (
        <li key={stat.label.toLowerCase()}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-sm font-medium text-charcoal truncate">
              {stat.label}
              {stat.crossCount > 0 && (
                <span
                  className={`ml-2 inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full border-[1px] align-middle ${badgeColor}`}
                  title={crossLabel}
                >
                  ⇄ {stat.crossCount}
                </span>
              )}
            </span>
            <span className="text-xs text-charcoal/50 shrink-0">
              {stat.count}× {countLabel} · {Math.round((stat.count / total) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface border-[1px] border-hairline overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor} transition-all duration-500`}
              style={{ width: `${Math.max(6, (stat.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function InsightsPage({ language }: InsightsPageProps) {
  const t = STRINGS[language];

  const [analyses, setAnalyses] = useState<AnalysisRow[] | null>(null);
  const [usage, setUsage] = useState<UsageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([db.listAnalyses(), db.listUsage()])
      .then(([analysisRows, usageRows]) => {
        setAnalyses(analysisRows);
        setUsage(usageRows);
      })
      .catch(() => setError(t.loadFailed));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { strengths, gaps } = useMemo(() => {
    if (!analyses) return { strengths: [] as SkillStat[], gaps: [] as SkillStat[] };

    const strengthMap = aggregate(analyses, "matching_skills");
    const gapMap = aggregate(analyses, "skill_gaps");

    // Cross-reference: the same skill can be matched in one run and missing
    // in another (different jobs) — surface that instead of hiding it.
    for (const [key, stat] of strengthMap) stat.crossCount = gapMap.get(key)?.count ?? 0;
    for (const [key, stat] of gapMap) stat.crossCount = strengthMap.get(key)?.count ?? 0;

    const byCount = (a: SkillStat, b: SkillStat) => b.count - a.count || a.label.localeCompare(b.label);
    return {
      strengths: [...strengthMap.values()].sort(byCount).slice(0, TOP_N),
      gaps: [...gapMap.values()].sort(byCount).slice(0, TOP_N),
    };
  }, [analyses]);

  const usageStats = useMemo(() => {
    if (!usage) return null;
    const todayUtc = new Date().toISOString().slice(0, 10);
    const runsToday = usage.filter((row) => row.created_at.slice(0, 10) === todayUtc).length;
    const promptTokens = usage.reduce((sum, row) => sum + (row.prompt_tokens ?? 0), 0);
    const outputTokens = usage.reduce((sum, row) => sum + (row.output_tokens ?? 0), 0);
    const cost = (promptTokens / 1_000_000) * INPUT_COST_PER_M + (outputTokens / 1_000_000) * OUTPUT_COST_PER_M;
    return { runsToday, totalTokens: promptTokens + outputTokens, cost };
  }, [usage]);

  const isLoading = !error && (analyses === null || usage === null);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h2 className="text-2xl font-extrabold tracking-tight text-obsidian">{t.title}</h2>
      <p className="mt-1 mb-8 text-sm text-charcoal/60">{t.subtitle}</p>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {isLoading && <p className="text-sm text-cobalt animate-pulse">{t.loading}</p>}

      {analyses !== null && analyses.length === 0 && !error && (
        <p className="text-sm text-charcoal/40">{t.empty}</p>
      )}

      {analyses !== null && analyses.length > 0 && usageStats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {[
              { label: t.totalAnalyses, value: String(analyses.length) },
              { label: t.runsToday, value: String(usageStats.runsToday) },
              { label: t.totalTokens, value: usageStats.totalTokens.toLocaleString(language === "de" ? "de-DE" : "en-US") },
              { label: t.estCost, value: `$${usageStats.cost.toFixed(4)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border-[1px] border-hairline shadow-sm px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-charcoal/50">{label}</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-obsidian">{value}</p>
              </div>
            ))}
          </div>

          {/* Strengths vs. gaps — clearly separated */}
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-xl border-[1px] border-hairline shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-obsidian">{t.strengthsTitle}</h3>
              </div>
              <p className="text-xs text-charcoal/50 mb-5">{t.strengthsHint}</p>
              <SkillBars
                stats={strengths}
                total={analyses.length}
                tone="emerald"
                countLabel={t.timesMatched}
                crossLabel={t.alsoGap}
                emptyLabel={t.noData}
              />
            </section>

            <section className="bg-white rounded-xl border-[1px] border-amber-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-obsidian">{t.gapsTitle}</h3>
              </div>
              <p className="text-xs text-charcoal/50 mb-5">{t.gapsHint}</p>
              <SkillBars
                stats={gaps}
                total={analyses.length}
                tone="amber"
                countLabel={t.timesMissing}
                crossLabel={t.alsoStrength}
                emptyLabel={t.noData}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
