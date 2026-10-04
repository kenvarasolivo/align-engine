import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import type { AIProvider, JobRow, Language, Mode, ResumeRow, UsageInfo, WritingStyle } from "../types";
import * as db from "../lib/db";

interface InputPanelProps {
  provider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
  providerUsage: Record<AIProvider, UsageInfo | null>;
  language: Language;
  onLanguageChange: (language: Language) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  personalMotivation: string;
  onPersonalMotivationChange: (value: string) => void;
  writingStyle: WritingStyle;
  onWritingStyleChange: (value: WritingStyle) => void;
  resumeText: string;
  onResumeChange: (value: string) => void;
  resumeTitle: string;
  onResumeTitleChange: (value: string) => void;
  jobDescriptionText: string;
  onJobDescriptionChange: (value: string) => void;
  jobTitle: string;
  onJobTitleChange: (value: string) => void;
  onAnalyze: () => void;
  onCancel: () => void;
  onUseExample: () => void;
  isLoading: boolean;
  error: string | null;
  /** True when the user is signed in and can persist to Supabase. */
  canSave: boolean;
  onSaveResume: () => Promise<boolean>;
  onSaveJob: () => Promise<boolean>;
  /** Called after a file upload replaces the resume text. */
  onResumeFileUploaded: () => void;
  onUseResume: (row: ResumeRow) => void;
  onUseJob: (row: JobRow) => void;
}

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt";

type SaveState = "idle" | "saving" | "saved" | "failed";

const STRINGS: Record<
  Language,
  {
    resumeLabel: string;
    resumePlaceholder: string;
    resumeTitlePlaceholder: string;
    jobLabel: string;
    jobPlaceholder: string;
    jobTitlePlaceholder: string;
    titleLabel: string;
    formatLabel: string;
    langLabel: string;
    coverLetterOpt: string;
    emailOpt: string;
    ctaAnschreiben: string;
    ctaEmail: string;
    analyzing: string;
    upload: string;
    extracting: string;
    dropHint: string;
    dropFormats: string;
    uploadFailed: string;
    save: string;
    saving: string;
    saved: string;
    saveFailed: string;
  }
> = {
  en: {
    resumeLabel: "Resume",
    resumePlaceholder: "Paste your resume here, or upload a PDF / DOCX / TXT file…",
    resumeTitlePlaceholder: "e.g. Senior Backend Engineer CV",
    jobLabel: "Job Description",
    jobPlaceholder: "Paste the job description here…",
    jobTitlePlaceholder: "e.g. Acme — Platform Engineer",
    titleLabel: "Title",
    formatLabel: "Format",
    langLabel: "Interface & output language",
    coverLetterOpt: "Cover letter",
    emailOpt: "Email",
    ctaAnschreiben: "Generate cover letter",
    ctaEmail: "Write outreach email",
    analyzing: "Analyzing…",
    upload: "Upload file",
    extracting: "Extracting…",
    dropHint: "Drop your resume file",
    dropFormats: "PDF · DOCX · TXT",
    uploadFailed: "Could not read the file.",
    save: "Save",
    saving: "Saving…",
    saved: "Saved ✓",
    saveFailed: "Save failed",
  },
  de: {
    resumeLabel: "Lebenslauf",
    resumePlaceholder: "Lebenslauf hier einfügen oder als PDF / DOCX / TXT hochladen…",
    resumeTitlePlaceholder: "z. B. Lebenslauf Senior Backend Engineer",
    jobLabel: "Stellenbeschreibung",
    jobPlaceholder: "Stellenbeschreibung hier einfügen…",
    jobTitlePlaceholder: "z. B. Acme — Platform Engineer",
    titleLabel: "Titel",
    formatLabel: "Format",
    langLabel: "Sprache für Oberfläche & Ausgabe",
    coverLetterOpt: "Anschreiben",
    emailOpt: "E-Mail",
    ctaAnschreiben: "Anschreiben erstellen",
    ctaEmail: "E-Mail schreiben",
    analyzing: "Analysiere…",
    upload: "Datei hochladen",
    extracting: "Wird extrahiert…",
    dropHint: "Lebenslauf-Datei hier ablegen",
    dropFormats: "PDF · DOCX · TXT",
    uploadFailed: "Die Datei konnte nicht gelesen werden.",
    save: "Speichern",
    saving: "Speichert…",
    saved: "Gespeichert ✓",
    saveFailed: "Fehlgeschlagen",
  },
};

function SaveButton({
  state,
  disabled,
  onClick,
  strings,
}: {
  state: SaveState;
  disabled: boolean;
  onClick: () => void;
  strings: (typeof STRINGS)["en"];
}) {
  const label =
    state === "saving"
      ? strings.saving
      : state === "saved"
        ? strings.saved
        : state === "failed"
          ? strings.saveFailed
          : strings.save;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "saving"}
      className={`btn-secondary px-2.5 py-1 text-xs ${
        state === "saved"
          ? "text-success-strong border-success-border hover:text-success-strong hover:border-success-border"
          : state === "failed"
            ? "text-danger border-danger-border hover:text-danger hover:border-danger-border"
            : "hover:text-cobalt hover:border-cobalt/40"
      }`}
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <path d="M17 21v-8H7v8M7 3v5h8" />
      </svg>
      <span>{label}</span>
    </button>
  );
}

function TitleField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-5 pb-2">
      <span className="label-caps shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        spellCheck={false}
        className="flex-1 min-w-0 h-7 rounded-md border border-transparent bg-transparent px-1.5 text-sm font-medium text-charcoal outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-charcoal/65 hover:border-hairline focus:border-cobalt/50 focus:bg-panel focus:ring-4 focus:ring-cobalt/10"
      />
    </div>
  );
}

const DOC_ICON = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

const MAIL_ICON = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

/** Icon + full-word segmented control used for the output Format / Language choices. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-caps">{label}</span>
      <div
        className="flex w-fit items-center p-0.5 rounded-lg border border-hairline bg-surface-sunken/70"
        role="group"
        aria-label={label}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={`focus-ring inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
              value === opt.value
                ? "bg-panel text-cobalt shadow-xs ring-1 ring-black/[0.04]"
                : "text-charcoal/60 hover:text-obsidian"
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function InputPanel({
  provider,
  onProviderChange,
  providerUsage,
  language,
  onLanguageChange,
  mode,
  onModeChange,
  personalMotivation,
  onPersonalMotivationChange,
  writingStyle,
  onWritingStyleChange,
  resumeText,
  onResumeChange,
  resumeTitle,
  onResumeTitleChange,
  jobDescriptionText,
  onJobDescriptionChange,
  jobTitle,
  onJobTitleChange,
  onAnalyze,
  onCancel,
  onUseExample,
  isLoading,
  error,
  canSave,
  onSaveResume,
  onSaveJob,
  onResumeFileUploaded,
  onUseResume,
  onUseJob,
}: InputPanelProps) {
  const t = STRINGS[language];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const [resumeSaveState, setResumeSaveState] = useState<SaveState>("idle");
  const [jobSaveState, setJobSaveState] = useState<SaveState>("idle");
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState(false);
  const [libraryRevision, setLibraryRevision] = useState(0);

  useEffect(() => {
    if (!canSave) return;
    let cancelled = false;
    setLibraryLoading(true);
    setLibraryError(false);
    Promise.all([db.listResumes(), db.listJobs()])
      .then(([savedResumes, savedJobs]) => {
        if (cancelled) return;
        setResumes(savedResumes);
        setJobs(savedJobs);
      })
      .catch(() => { if (!cancelled) setLibraryError(true); })
      .finally(() => { if (!cancelled) setLibraryLoading(false); });
    return () => { cancelled = true; };
  }, [canSave, libraryRevision]);

  const savedPicker = <T extends ResumeRow | JobRow,>(items: T[], text: string, title: string, kind: "resume" | "job", onUse: (row: T) => void) => {
    if (!canSave) return null;
    const label = language === "de"
      ? (kind === "resume" ? "Gespeicherter Lebenslauf" : "Gespeicherter Job")
      : (kind === "resume" ? "Saved resume" : "Saved job");
    return (
      <div className="mx-5 mb-2">
        <label className="flex items-center gap-3 text-xs text-charcoal/65">
          <span className="shrink-0">{label}</span>
          <select aria-label={label} className="focus-ring min-h-9 min-w-0 flex-1 rounded-lg border border-hairline bg-panel px-2 text-sm text-charcoal"
            disabled={libraryLoading || libraryError || !items.length || isExtracting || isLoading}
            value={items.find((item) => item.content === text && item.title === title)?.id ?? ""}
            onChange={(event) => {
              const item = items.find((item) => item.id === event.target.value);
              if (item) { onUse(item); if (kind === "resume") { setUploadedFileName(null); setUploadError(null); } }
            }}>
            <option value="">{libraryLoading ? (language === "de" ? "Wird geladen…" : "Loading…")
              : libraryError ? (language === "de" ? "Nicht verfügbar" : "Unavailable")
              : !items.length ? (language === "de" ? "Noch keine gespeichert" : "No saved items yet")
              : (language === "de" ? "Gespeicherten Eintrag auswählen…" : "Choose a saved item…")}</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.title} · {new Date(item.created_at).toLocaleDateString(language === "de" ? "de-DE" : "en-US")}</option>)}
          </select>
        </label>
        {libraryError && <button type="button" onClick={() => setLibraryRevision((value) => value + 1)} className="focus-ring mt-1 text-xs text-cobalt">{language === "de" ? "Erneut laden" : "Retry loading saved items"}</button>}
      </div>
    );
  };

  const canSubmit = !isLoading && !isExtracting && resumeText.trim().length > 0 && jobDescriptionText.trim().length > 0;

  const runSave = async (
    save: () => Promise<boolean>,
    setState: (state: SaveState) => void
  ) => {
    setState("saving");
    const ok = await save();
    setState(ok ? "saved" : "failed");
    if (ok) setLibraryRevision((value) => value + 1);
    setTimeout(() => setState("idle"), 2500);
  };

  const uploadResumeFile = async (file: File) => {
    if (isExtracting || isLoading) return;
    setIsExtracting(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? t.uploadFailed);
      }

      const data: { filename: string; text: string } = await response.json();
      onResumeChange(data.text);
      onResumeFileUploaded();
      setUploadedFileName(data.filename);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t.uploadFailed);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadResumeFile(file);
  };

  const wellClass = (active = false) =>
    `flex-1 flex min-h-0 mx-4 mb-4 rounded-xl border bg-surface/70 transition-all duration-150 ${
      active
        ? "border-cobalt/60 bg-cobalt-50/50"
        : "border-hairline focus-within:border-cobalt/50 focus-within:bg-panel focus-within:ring-4 focus-within:ring-cobalt/10"
    }`;

  return (
    <section className="flex flex-col min-h-[560px] lg:min-h-0 lg:h-full overflow-y-auto rounded-2xl border border-hairline bg-panel shadow-card">
      {/* Top half — Resume (paste, upload, or drag & drop) */}
      <div
        className="relative flex-1 flex flex-col min-h-[200px]"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2.5">
          <span className="label-caps">{t.resumeLabel}</span>

          <div className="flex items-center gap-2 min-w-0">
            {uploadError && (
              <span className="text-xs text-danger truncate" role="alert">
                {uploadError}
              </span>
            )}
            {!uploadError && uploadedFileName && !isExtracting && (
              <span className="inline-flex items-center gap-1.5 max-w-[180px] truncate rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-2xs font-medium text-charcoal/60">
                <svg className="h-3 w-3 shrink-0 text-charcoal/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
                <span className="truncate">{uploadedFileName}</span>
              </span>
            )}
            {canSave && (
              <SaveButton
                state={resumeSaveState}
                disabled={resumeText.trim().length === 0}
                onClick={() => void runSave(onSaveResume, setResumeSaveState)}
                strings={t}
              />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting || isLoading}
              className={`btn-secondary px-2.5 py-1 text-xs ${
                isExtracting ? "text-cobalt" : "hover:text-cobalt hover:border-cobalt/40"
              }`}
            >
              {isExtracting ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span>{t.extracting}</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
                    <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
                  </svg>
                  <span>{t.upload}</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadResumeFile(file);
                event.target.value = ""; // allow re-uploading the same file
              }}
            />
          </div>
        </div>

        {savedPicker(resumes, resumeText, resumeTitle, "resume", onUseResume)}
        <TitleField
          label={t.titleLabel}
          value={resumeTitle}
          onChange={onResumeTitleChange}
          placeholder={t.resumeTitlePlaceholder}
        />

        <div className={wellClass(isDragActive)}>
          <textarea
            value={resumeText}
            onChange={(event) => onResumeChange(event.target.value)}
            placeholder={t.resumePlaceholder}
            spellCheck={false}
            aria-label={t.resumeLabel}
            className="editor-surface flex-1 w-full min-h-0 rounded-xl px-4 py-3 text-sm leading-relaxed border-none outline-none"
          />
        </div>

        {isDragActive && (
          <div className="absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cobalt bg-panel/85 backdrop-blur-sm pointer-events-none animate-fade-in">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cobalt-50 text-cobalt">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
                <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-cobalt">{t.dropHint}</span>
            <span className="text-2xs font-medium uppercase tracking-widest text-charcoal/40">{t.dropFormats}</span>
          </div>
        )}
      </div>

      {/* Hairline divider */}
      <div className="border-t border-hairline" />

      {/* Bottom half — Job Description */}
      <div className="flex-1 flex flex-col min-h-[200px]">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2.5">
          <span className="label-caps">{t.jobLabel}</span>
          {canSave && (
            <SaveButton
              state={jobSaveState}
              disabled={jobDescriptionText.trim().length === 0}
              onClick={() => void runSave(onSaveJob, setJobSaveState)}
              strings={t}
            />
          )}
        </div>
        {savedPicker(jobs, jobDescriptionText, jobTitle, "job", onUseJob)}
        <TitleField
          label={t.titleLabel}
          value={jobTitle}
          onChange={onJobTitleChange}
          placeholder={t.jobTitlePlaceholder}
        />
        <div className={wellClass()}>
          <textarea
            value={jobDescriptionText}
            onChange={(event) => onJobDescriptionChange(event.target.value)}
            placeholder={t.jobPlaceholder}
            spellCheck={false}
            aria-label={t.jobLabel}
            className="editor-surface flex-1 w-full min-h-0 rounded-xl px-4 py-3 text-sm leading-relaxed border-none outline-none"
          />
        </div>
      </div>

      {/* Action bar pinned to the bottom — output choices sit on the path to the CTA */}
      <div className="shrink-0 px-4 py-4 bg-surface/60 border-t border-hairline">
        <div className="mb-3.5">
          <Segmented
            label={language === "de" ? "KI-Modell" : "AI model"}
            value={provider}
            onChange={onProviderChange}
            options={[
              { value: "gemini", label: "Gemini" },
              { value: "openai", label: "GPT-6 Luna" },
            ]}
          />
          <p className="mt-1.5 text-xs text-charcoal/65" role="status">
            {(["gemini", "openai"] as const).map((value, index) => {
              const used = providerUsage[value];
              return <span key={value}>{index > 0 ? " · " : ""}{value === "openai" ? "GPT-6 Luna" : "Gemini"}: {used ? `${used.used_today}/${used.daily_limit}` : language === "de" ? "20 pro Tag" : "20 per day"}</span>;
            })}
          </p>
        </div>
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <Segmented
            label={t.formatLabel}
            value={mode}
            onChange={onModeChange}
            options={[
              { value: "anschreiben", label: t.coverLetterOpt, icon: DOC_ICON },
              { value: "email", label: t.emailOpt, icon: MAIL_ICON },
            ]}
          />
          <Segmented
            label={t.langLabel}
            value={language}
            onChange={onLanguageChange}
            options={[
              { value: "en", label: "English" },
              { value: "de", label: "Deutsch" },
            ]}
          />
        </div>
        <div className="mb-3.5 flex flex-col items-start">
          <Segmented
            label={language === "de" ? "Schreibstil" : "Writing style"}
            value={writingStyle}
            onChange={onWritingStyleChange}
            options={[
              { value: "neutral", label: "Neutral" },
              { value: "direct", label: language === "de" ? "Direkt" : "Direct" },
              { value: "friendly", label: language === "de" ? "Freundlich" : "Friendly" },
            ]}
          />
        </div>
        <details className="mb-3.5 rounded-lg border border-hairline bg-panel px-3 py-2">
          <summary className="focus-ring cursor-pointer text-sm text-charcoal/75">
            {language === "de" ? "Möchtest du etwas ergänzen? (optional)" : "Anything you'd like to add? (optional)"}
            {personalMotivation.trim() && <span className="ml-2 text-xs text-cobalt">{language === "de" ? "Hinzugefügt" : "Added"}</span>}
          </summary>
          <label htmlFor="personal-motivation" className="mt-2 block text-xs leading-relaxed text-charcoal/65">
            {language === "de"
              ? "Warum interessiert dich diese Stelle oder das Unternehmen? Gibt es etwas, das dein Lebenslauf nicht erklärt?"
              : "Why does this role or company interest you? Is there something your CV doesn't explain?"}
          </label>
          <textarea
            id="personal-motivation"
            value={personalMotivation}
            onChange={(event) => onPersonalMotivationChange(event.target.value)}
            maxLength={2000}
            rows={3}
            className="focus-ring mt-2 w-full resize-y rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-charcoal"
            placeholder={language === "de" ? "Ein paar persönliche Sätze reichen…" : "A few personal sentences are enough…"}
          />
        </details>
        {error && (
          <div
            className="mb-3 flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft px-3 py-2.5 animate-fade-in"
            role="alert"
          >
            <svg className="mt-px h-3.5 w-3.5 shrink-0 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            <p className="text-xs leading-snug text-danger-strong">{error}</p>
          </div>
        )}
        {!resumeText.trim() && !jobDescriptionText.trim() && <button type="button" onClick={onUseExample} className="focus-ring mb-3 rounded-md text-sm font-medium text-cobalt">{language === "de" ? "Mit Beispieldaten ausprobieren" : "Try with example inputs"}</button>}
        <details className="mb-3 text-xs leading-relaxed text-charcoal/75">
          <summary className="focus-ring cursor-pointer rounded-md">{language === "de" ? "Was passiert mit meinen Daten?" : "What happens to my data?"}</summary>
          <p className="mt-2">{language === "de" ? "Für Analyse und Lernplan werden Ihre Texte und optionalen Angaben je nach Servereinstellung an OpenAI oder Google Gemini gesendet. Die Suche nach Lernressourcen verwendet Google Gemini für Embeddings. Hochgeladene Dateien werden auf unserem Server in Text umgewandelt. Angemeldet werden Analysen im Supabase-Verlauf gespeichert; ungesendete Entwurfsänderungen bleiben bis zur Synchronisierung auf diesem Gerät. Gäste erhalten keinen gespeicherten Verlauf. Exportieren Sie Ihren Entwurf, um ihn zu behalten." : "Analysis and learning plans send your text and optional context to OpenAI or Google Gemini, depending on the server setting. Learning-resource retrieval uses Google Gemini embeddings. Uploaded files are converted to text on our server. Signed-in analyses are saved in Supabase history; unsent draft edits stay on this device until synced. Guests have no saved history. Export your draft to keep it."}</p>
          <p className="mt-2">{language === "de" ? "Jedes KI-Modell hat ein eigenes Limit von 20 Versuchen pro Tag. Analyse und Lernplan teilen dieses Limit; Fehler und Abbruch zählen ebenfalls. Zurücksetzung um 00:00 UTC. Gäste teilen das Limit ihrer Netzwerkadresse; dafür speichern wir nur einen geschützten Hash." : "Each AI model has its own limit of 20 attempts per day, shared by analysis and learning plans. Failures and cancellations also count. Limits reset at 00:00 UTC. Guests share a limit by network address; only a keyed hash is stored for that counter."}</p>
        </details>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canSubmit}
          className={`focus-ring w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 ease-out-quart ${
            isLoading
              ? "bg-cobalt shadow-cta"
              : canSubmit
                ? "bg-cobalt shadow-cta hover:bg-cobalt-hover hover:shadow-cta-lg hover:-translate-y-px active:translate-y-0 active:bg-cobalt-active active:shadow-cta"
                : "bg-cobalt/35"
          } disabled:pointer-events-none`}
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span>{t.analyzing}</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />
              </svg>
              <span>{mode === "anschreiben" ? t.ctaAnschreiben : t.ctaEmail}</span>
              <span className="ml-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide">
                {language}
              </span>
            </>
          )}
        </button>
        {isLoading && <button type="button" onClick={onCancel} className="focus-ring mt-2 w-full rounded-lg py-2 text-sm font-medium text-charcoal">{language === "de" ? "Abbrechen · bisherigen Entwurf behalten" : "Cancel · keep previous draft"}</button>}
      </div>
    </section>
  );
}
