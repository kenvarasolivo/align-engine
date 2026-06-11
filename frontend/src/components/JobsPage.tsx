import { useEffect, useState } from "react";
import * as db from "../lib/db";
import type { JobRow, Language } from "../types";

interface JobsPageProps {
  language: Language;
  onUseJob: (row: JobRow) => void;
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
    saved: string;
    saveTitle: string;
    cancel: string;
  }
> = {
  en: {
    title: "Saved Jobs",
    subtitle: "Bookmarked job postings — load one into the Workspace to reanalyze it against any resume.",
    empty: "No saved jobs yet. In the Workspace, paste a job description and hit “Save”.",
    loading: "Loading saved jobs…",
    loadFailed: "Could not load your saved jobs.",
    use: "Use in Workspace",
    rename: "Rename",
    delete: "Delete",
    confirmDelete: "Delete forever?",
    saved: "Saved",
    saveTitle: "Save",
    cancel: "Cancel",
  },
  de: {
    title: "Gespeicherte Jobs",
    subtitle: "Gemerkte Stellenanzeigen — laden Sie eine in den Workspace, um sie mit jedem Lebenslauf neu zu analysieren.",
    empty: "Noch keine Jobs gespeichert. Fügen Sie im Workspace eine Stellenbeschreibung ein und klicken Sie auf „Speichern“.",
    loading: "Gespeicherte Jobs werden geladen…",
    loadFailed: "Die gespeicherten Jobs konnten nicht geladen werden.",
    use: "Im Workspace verwenden",
    rename: "Umbenennen",
    delete: "Löschen",
    confirmDelete: "Endgültig löschen?",
    saved: "Gespeichert",
    saveTitle: "Speichern",
    cancel: "Abbrechen",
  },
};

export default function JobsPage({ language, onUseJob }: JobsPageProps) {
  const t = STRINGS[language];

  const [rows, setRows] = useState<JobRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    db.listJobs()
      .then(setRows)
      .catch(() => setError(t.loadFailed));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const commitRename = async (row: JobRow) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title || title === row.title) return;
    try {
      await db.renameJob(row.id, title);
      setRows((current) => current?.map((item) => (item.id === row.id ? { ...item, title } : item)) ?? null);
    } catch {
      setError(t.loadFailed);
    }
  };

  const handleDelete = async (row: JobRow) => {
    if (confirmingId !== row.id) {
      setConfirmingId(row.id);
      setTimeout(() => setConfirmingId((current) => (current === row.id ? null : current)), 3000);
      return;
    }
    setConfirmingId(null);
    try {
      await db.deleteJob(row.id);
      setRows((current) => current?.filter((item) => item.id !== row.id) ?? null);
    } catch {
      setError(t.loadFailed);
    }
  };

  const locale = language === "de" ? "de-DE" : "en-US";

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
        {rows?.map((row) => (
          <div key={row.id} className="bg-white rounded-xl border-[1px] border-hairline shadow-sm px-5 py-4">
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
                      className="flex-1 h-8 px-2 text-sm rounded-md border-[1px] border-cobalt/40 outline-none focus:ring-2 focus:ring-cobalt/10"
                    />
                    <button
                      type="button"
                      onClick={() => void commitRename(row)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-cobalt text-white hover:bg-cobalt-hover"
                    >
                      {t.saveTitle}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border-[1px] border-hairline text-charcoal/70"
                    >
                      {t.cancel}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-obsidian truncate">{row.title}</p>
                    <p className="mt-0.5 text-xs text-charcoal/50">
                      {t.saved}:{" "}
                      {new Date(row.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </>
                )}
              </div>

              {renamingId !== row.id && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUseJob(row)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-cobalt text-white transition-all duration-200 hover:bg-cobalt-hover"
                  >
                    {t.use}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(row.id);
                      setRenameValue(row.title);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border-[1px] border-hairline bg-white text-charcoal/70 transition-all duration-200 hover:text-cobalt hover:border-cobalt/40"
                  >
                    {t.rename}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border-[1px] transition-all duration-200 ${
                      confirmingId === row.id
                        ? "bg-red-600 border-red-600 text-white"
                        : "border-hairline bg-white text-charcoal/70 hover:text-red-600 hover:border-red-200"
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
