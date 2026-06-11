import { useEffect, useState } from "react";
import * as db from "../lib/db";
import type { AnalysisRow, Language } from "../types";

interface HistoryPageProps {
  language: Language;
  onLoadAnalysis: (row: AnalysisRow) => void;
}

const STRINGS: Record<
  Language,
  {
    title: string;
    subtitle: string;
    empty: string;
    loading: string;
    loadFailed: string;
    matching: string;
    gaps: string;
    draft: string;
    edited: string;
    open: string;
    copy: string;
    copied: string;
    delete: string;
    confirmDelete: string;
    modeLabels: Record<string, string>;
  }
> = {
  en: {
    title: "Analysis History",
    subtitle: "Every saved run — revisit, compare, or re-export previous drafts without spending another analysis.",
    empty: "No analyses yet. Run one from the Workspace and it will be saved here automatically.",
    loading: "Loading your history…",
    loadFailed: "Could not load your history.",
    matching: "Matching skills",
    gaps: "Skill gaps",
    draft: "Draft",
    edited: "edited",
    open: "Open in Workspace",
    copy: "Copy draft",
    copied: "Copied ✓",
    delete: "Delete",
    confirmDelete: "Delete forever?",
    modeLabels: { anschreiben: "Anschreiben", email: "Email" },
  },
  de: {
    title: "Analyse-Verlauf",
    subtitle: "Jeder gespeicherte Lauf — erneut ansehen, vergleichen oder frühere Entwürfe exportieren, ohne eine neue Analyse zu verbrauchen.",
    empty: "Noch keine Analysen. Starten Sie eine im Workspace — sie wird hier automatisch gespeichert.",
    loading: "Verlauf wird geladen…",
    loadFailed: "Der Verlauf konnte nicht geladen werden.",
    matching: "Übereinstimmende Kompetenzen",
    gaps: "Kompetenzlücken",
    draft: "Entwurf",
    edited: "bearbeitet",
    open: "Im Workspace öffnen",
    copy: "Entwurf kopieren",
    copied: "Kopiert ✓",
    delete: "Löschen",
    confirmDelete: "Endgültig löschen?",
    modeLabels: { anschreiben: "Anschreiben", email: "E-Mail" },
  },
};

function rowTitle(row: AnalysisRow): string {
  const firstLine =
    row.job_description_snapshot.split("\n").map((line) => line.trim()).find(Boolean) ?? "—";
  return firstLine.length > 90 ? `${firstLine.slice(0, 87)}…` : firstLine;
}

export default function HistoryPage({ language, onLoadAnalysis }: HistoryPageProps) {
  const t = STRINGS[language];

  const [rows, setRows] = useState<AnalysisRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    db.listAnalyses()
      .then(setRows)
      .catch(() => setError(t.loadFailed));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = async (row: AnalysisRow) => {
    await navigator.clipboard.writeText(row.final_draft ?? row.generated_draft);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((current) => (current === row.id ? null : current)), 2000);
  };

  const handleDelete = async (row: AnalysisRow) => {
    if (confirmingId !== row.id) {
      setConfirmingId(row.id);
      setTimeout(() => setConfirmingId((current) => (current === row.id ? null : current)), 3000);
      return;
    }
    setConfirmingId(null);
    try {
      await db.deleteAnalysis(row.id);
      setRows((current) => current?.filter((item) => item.id !== row.id) ?? null);
    } catch {
      setError(t.loadFailed);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h2 className="text-2xl font-extrabold tracking-tight text-obsidian">{t.title}</h2>
      <p className="mt-1 mb-8 text-sm text-charcoal/60">{t.subtitle}</p>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!error && rows === null && <p className="text-sm text-cobalt animate-pulse">{t.loading}</p>}

      {rows !== null && rows.length === 0 && <p className="text-sm text-charcoal/40">{t.empty}</p>}

      <div className="space-y-3">
        {rows?.map((row) => {
          const isExpanded = expandedId === row.id;
          return (
            <div key={row.id} className="bg-white rounded-xl border-[1px] border-hairline shadow-sm overflow-hidden">
              {/* Summary row */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 hover:bg-surface"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-obsidian truncate">{rowTitle(row)}</p>
                  <p className="mt-0.5 text-xs text-charcoal/50">
                    {new Date(row.created_at).toLocaleString(language === "de" ? "de-DE" : "en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-surface border-[1px] border-hairline text-charcoal/70">
                    {t.modeLabels[row.mode] ?? row.mode}
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-surface border-[1px] border-hairline text-charcoal/70 uppercase">
                    {row.language}
                  </span>
                  {row.final_draft && row.final_draft !== row.generated_draft && (
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-cobalt/10 text-cobalt">
                      {t.edited}
                    </span>
                  )}
                  <svg
                    className={`h-4 w-4 text-charcoal/40 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </button>

              {/* Detail */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t-[1px] border-hairline space-y-5">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-charcoal/50 mt-4 mb-2">
                      {t.matching}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {row.matching_skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg border-[1px] border-emerald-100"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-charcoal/50 mb-2">{t.gaps}</h3>
                    <div className="flex flex-wrap gap-2">
                      {row.skill_gaps.map((gap) => (
                        <span
                          key={gap}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg border-[1px] border-amber-100"
                        >
                          {gap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-charcoal/50 mb-2">{t.draft}</h3>
                    <pre className="max-h-64 overflow-y-auto px-4 py-3 text-xs leading-relaxed text-charcoal whitespace-pre-wrap font-sans bg-surface rounded-lg border-[1px] border-hairline">
                      {row.final_draft ?? row.generated_draft}
                    </pre>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onLoadAnalysis(row)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-cobalt text-white transition-all duration-200 hover:bg-cobalt-hover"
                    >
                      {t.open}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy(row)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border-[1px] border-hairline bg-white text-charcoal/70 transition-all duration-200 hover:text-cobalt hover:border-cobalt/40"
                    >
                      {copiedId === row.id ? t.copied : t.copy}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      className={`ml-auto px-3 py-1.5 text-xs font-medium rounded-md border-[1px] transition-all duration-200 ${
                        confirmingId === row.id
                          ? "bg-red-600 border-red-600 text-white"
                          : "border-hairline bg-white text-charcoal/70 hover:text-red-600 hover:border-red-200"
                      }`}
                    >
                      {confirmingId === row.id ? t.confirmDelete : t.delete}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
