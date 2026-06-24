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
    rename: string;
    saveTitle: string;
    cancel: string;
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
    rename: "Rename",
    saveTitle: "Save",
    cancel: "Cancel",
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
    rename: "Umbenennen",
    saveTitle: "Speichern",
    cancel: "Abbrechen",
    modeLabels: { anschreiben: "Anschreiben", email: "E-Mail" },
  },
};

function rowTitle(row: AnalysisRow): string {
  // Prefer the user's explicit/editable title; fall back to the job's first
  // line for older rows saved before titles existed.
  const explicit = row.title?.trim();
  if (explicit) return explicit.length > 90 ? `${explicit.slice(0, 87)}…` : explicit;
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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

  const startRename = (row: AnalysisRow) => {
    setRenamingId(row.id);
    setRenameValue(rowTitle(row));
  };

  const commitRename = async (row: AnalysisRow) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title || title === (row.title ?? "")) return;
    try {
      await db.renameAnalysis(row.id, title);
      setRows((current) => current?.map((item) => (item.id === row.id ? { ...item, title } : item)) ?? null);
    } catch {
      setError(t.loadFailed);
    }
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
    <div className="max-w-4xl mx-auto px-4 lg:px-6 py-10 animate-fade-in">
      <h2 className="text-2xl font-extrabold tracking-tight text-obsidian">{t.title}</h2>
      <p className="mt-1.5 mb-8 max-w-2xl text-sm leading-relaxed text-charcoal/55">{t.subtitle}</p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5" role="alert">
          <svg className="mt-px h-3.5 w-3.5 shrink-0 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <p className="text-xs leading-snug text-danger-strong">{error}</p>
        </div>
      )}

      {!error && rows === null && (
        <div className="space-y-3" aria-busy="true" aria-label={t.loading}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card px-5 py-4">
              <div className="skeleton h-4 w-2/3 mb-2.5" />
              <div className="skeleton h-3 w-36" />
            </div>
          ))}
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-hairline-strong bg-white/60 px-8 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt-50 text-cobalt mb-4" aria-hidden="true">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-charcoal/55">{t.empty}</p>
        </div>
      )}

      <div className="space-y-3">
        {rows?.map((row) => {
          const isExpanded = expandedId === row.id;
          return (
            <div
              key={row.id}
              className={`bg-white rounded-xl border border-hairline overflow-hidden transition-shadow duration-200 ${
                isExpanded ? "shadow-card" : "shadow-xs hover:shadow-card"
              }`}
            >
              {/* Summary row */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
                aria-expanded={isExpanded}
                className="focus-ring w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-surface/70"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-obsidian truncate">{rowTitle(row)}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-charcoal/50">
                    {new Date(row.created_at).toLocaleString(language === "de" ? "de-DE" : "en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {row.match_score != null && (
                    <span
                      className={`px-2 py-0.5 text-2xs font-bold tabular-nums rounded-full border ${
                        row.match_score >= 75
                          ? "text-success-strong bg-success-soft border-success-border"
                          : row.match_score >= 45
                            ? "text-cobalt bg-cobalt-50 border-cobalt/30"
                            : "text-warning-strong bg-warning-soft border-warning-border"
                      }`}
                    >
                      {row.match_score}%
                    </span>
                  )}
                  <span className="px-2 py-0.5 text-2xs font-medium rounded-full bg-surface border border-hairline text-charcoal/70">
                    {t.modeLabels[row.mode] ?? row.mode}
                  </span>
                  <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-surface border border-hairline text-charcoal/70 uppercase">
                    {row.language}
                  </span>
                  {row.final_draft && row.final_draft !== row.generated_draft && (
                    <span className="px-2 py-0.5 text-2xs font-medium rounded-full bg-cobalt-50 text-cobalt">
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
                <div className="px-5 pb-5 pt-1 border-t border-hairline space-y-5 animate-fade-in">
                  {renamingId === row.id && (
                    <div className="flex items-center gap-2 mt-4">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void commitRename(row);
                          if (event.key === "Escape") setRenamingId(null);
                        }}
                        className="flex-1 h-8 px-2.5 text-sm rounded-lg border border-cobalt/50 bg-white outline-none focus:ring-4 focus:ring-cobalt/10 transition-shadow duration-150"
                      />
                      <button
                        type="button"
                        onClick={() => void commitRename(row)}
                        className="btn-primary px-2.5 py-1 text-xs"
                      >
                        {t.saveTitle}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="btn-secondary px-2.5 py-1 text-xs"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  )}

                  <div>
                    <h3 className="label-caps mt-4 mb-2.5">{t.matching}</h3>
                    <div className="flex flex-wrap gap-2">
                      {row.matching_skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-success-strong bg-success-soft rounded-full border border-success-border"
                        >
                          <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="label-caps mb-2.5">{t.gaps}</h3>
                    <div className="flex flex-wrap gap-2">
                      {row.skill_gaps.map((gap) => (
                        <span
                          key={gap}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-warning-strong bg-warning-soft rounded-full border border-warning-border"
                        >
                          {gap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="label-caps mb-2.5">{t.draft}</h3>
                    <pre className="max-h-64 overflow-y-auto px-4 py-3 text-xs leading-relaxed text-charcoal whitespace-pre-wrap font-sans bg-surface rounded-lg border border-hairline">
                      {row.final_draft ?? row.generated_draft}
                    </pre>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onLoadAnalysis(row)}
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      {t.open}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy(row)}
                      className={`btn-secondary px-3 py-1.5 text-xs ${
                        copiedId === row.id
                          ? "text-success-strong border-success-border hover:text-success-strong hover:border-success-border"
                          : "hover:text-cobalt hover:border-cobalt/40"
                      }`}
                    >
                      {copiedId === row.id ? t.copied : t.copy}
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(row)}
                      className="btn-secondary px-3 py-1.5 text-xs hover:text-cobalt hover:border-cobalt/40"
                    >
                      {t.rename}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      className={`focus-ring ml-auto px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 ${
                        confirmingId === row.id
                          ? "bg-danger border-danger text-white shadow-xs"
                          : "border-hairline bg-white text-charcoal/70 shadow-xs hover:text-danger hover:border-danger-border"
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
