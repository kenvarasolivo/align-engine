import { useEffect, useState } from "react";
import * as db from "../lib/db";
import type { Language, ResumeRow } from "../types";

interface VaultPageProps {
  language: Language;
  onUseResume: (row: ResumeRow) => void;
}

const STRINGS: Record<
  Language,
  {
    title: string;
    subtitle: string;
    empty: string;
    loading: string;
    loadFailed: string;
    use: string;
    rename: string;
    delete: string;
    confirmDelete: string;
    lastUsed: string;
    never: string;
    saveTitle: string;
    cancel: string;
  }
> = {
  en: {
    title: "Resume Vault",
    subtitle: "Your stored resume versions. The most recently used one loads automatically when you return.",
    empty: "No resumes saved yet. In the Workspace, paste or upload a resume and hit “Save”.",
    loading: "Loading your vault…",
    loadFailed: "Could not load your resumes.",
    use: "Use in Workspace",
    rename: "Rename",
    delete: "Delete",
    confirmDelete: "Delete forever?",
    lastUsed: "Last used",
    never: "never",
    saveTitle: "Save",
    cancel: "Cancel",
  },
  de: {
    title: "Lebenslauf-Archiv",
    subtitle: "Ihre gespeicherten Lebenslauf-Versionen. Die zuletzt verwendete wird beim nächsten Besuch automatisch geladen.",
    empty: "Noch keine Lebensläufe gespeichert. Fügen Sie im Workspace einen ein und klicken Sie auf „Speichern“.",
    loading: "Archiv wird geladen…",
    loadFailed: "Die Lebensläufe konnten nicht geladen werden.",
    use: "Im Workspace verwenden",
    rename: "Umbenennen",
    delete: "Löschen",
    confirmDelete: "Endgültig löschen?",
    lastUsed: "Zuletzt verwendet",
    never: "nie",
    saveTitle: "Speichern",
    cancel: "Abbrechen",
  },
};

export default function VaultPage({ language, onUseResume }: VaultPageProps) {
  const t = STRINGS[language];

  const [rows, setRows] = useState<ResumeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    db.listResumes()
      .then(setRows)
      .catch(() => setError(t.loadFailed));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commitRename = async (row: ResumeRow) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title || title === row.title) return;
    try {
      await db.renameResume(row.id, title);
      setRows((current) => current?.map((item) => (item.id === row.id ? { ...item, title } : item)) ?? null);
    } catch {
      setError(t.loadFailed);
    }
  };

  const handleDelete = async (row: ResumeRow) => {
    if (confirmingId !== row.id) {
      setConfirmingId(row.id);
      setTimeout(() => setConfirmingId((current) => (current === row.id ? null : current)), 3000);
      return;
    }
    setConfirmingId(null);
    try {
      await db.deleteResume(row.id);
      setRows((current) => current?.filter((item) => item.id !== row.id) ?? null);
    } catch {
      setError(t.loadFailed);
    }
  };

  const locale = language === "de" ? "de-DE" : "en-US";

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
              <div className="skeleton h-4 w-1/3 mb-2.5" />
              <div className="skeleton h-3 w-48 mb-3" />
              <div className="skeleton h-3 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-hairline-strong bg-panel/60 px-8 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cobalt-50 text-cobalt mb-4" aria-hidden="true">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 13h6m-6 4h6" />
            </svg>
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-charcoal/55">{t.empty}</p>
        </div>
      )}

      <div className="space-y-3">
        {rows?.map((row) => (
          <div
            key={row.id}
            className="bg-panel rounded-xl border border-hairline shadow-xs px-5 py-4 transition-shadow duration-200 hover:shadow-card"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                {renamingId === row.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void commitRename(row);
                        if (event.key === "Escape") setRenamingId(null);
                      }}
                      className="flex-1 h-8 px-2.5 text-sm rounded-lg border border-cobalt/50 bg-panel outline-none focus:ring-4 focus:ring-cobalt/10 transition-shadow duration-150"
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
                ) : (
                  <>
                    <p className="text-sm font-semibold text-obsidian truncate">{row.title}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-charcoal/50">
                      {t.lastUsed}:{" "}
                      {row.last_used_at
                        ? new Date(row.last_used_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
                        : t.never}
                    </p>
                  </>
                )}
              </div>

              {renamingId !== row.id && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUseResume(row)}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    {t.use}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(row.id);
                      setRenameValue(row.title);
                    }}
                    className="btn-secondary px-3 py-1.5 text-xs hover:text-cobalt hover:border-cobalt/40"
                  >
                    {t.rename}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row)}
                    className={`focus-ring px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 ${
                      confirmingId === row.id
                        ? "bg-danger border-danger text-white shadow-xs"
                        : "border-hairline bg-panel text-charcoal/70 shadow-xs hover:text-danger hover:border-danger-border"
                    }`}
                  >
                    {confirmingId === row.id ? t.confirmDelete : t.delete}
                  </button>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-charcoal/50 line-clamp-2 whitespace-pre-line">
              {row.content.slice(0, 240)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
