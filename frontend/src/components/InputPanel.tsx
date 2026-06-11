import { useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Language } from "../types";

interface InputPanelProps {
  language: Language;
  resumeText: string;
  onResumeChange: (value: string) => void;
  jobDescriptionText: string;
  onJobDescriptionChange: (value: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  error: string | null;
  /** True when the user is signed in and can persist to Supabase. */
  canSave: boolean;
  onSaveResume: () => Promise<boolean>;
  onSaveJob: () => Promise<boolean>;
  /** Called after a file upload replaces the resume text. */
  onResumeFileUploaded: () => void;
}

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt";

type SaveState = "idle" | "saving" | "saved" | "failed";

const STRINGS: Record<
  Language,
  {
    resumeLabel: string;
    resumePlaceholder: string;
    jobLabel: string;
    jobPlaceholder: string;
    analyze: string;
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
    jobLabel: "Job Description",
    jobPlaceholder: "Paste the job description here…",
    analyze: "Run Alignment Analysis",
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
    jobLabel: "Stellenbeschreibung",
    jobPlaceholder: "Stellenbeschreibung hier einfügen…",
    analyze: "Analyse starten",
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

export default function InputPanel({
  language,
  resumeText,
  onResumeChange,
  jobDescriptionText,
  onJobDescriptionChange,
  onAnalyze,
  isLoading,
  error,
  canSave,
  onSaveResume,
  onSaveJob,
  onResumeFileUploaded,
}: InputPanelProps) {
  const t = STRINGS[language];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const [resumeSaveState, setResumeSaveState] = useState<SaveState>("idle");
  const [jobSaveState, setJobSaveState] = useState<SaveState>("idle");

  const canSubmit = !isLoading && resumeText.trim().length > 0 && jobDescriptionText.trim().length > 0;

  const runSave = async (
    save: () => Promise<boolean>,
    setState: (state: SaveState) => void
  ) => {
    setState("saving");
    const ok = await save();
    setState(ok ? "saved" : "failed");
    setTimeout(() => setState("idle"), 2500);
  };

  const uploadResumeFile = async (file: File) => {
    if (isExtracting) return;
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
        : "border-hairline focus-within:border-cobalt/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-cobalt/10"
    }`;

  return (
    <section className="flex flex-col min-h-[560px] lg:min-h-0 lg:h-full overflow-hidden rounded-2xl border border-hairline bg-white shadow-card">
      {/* Top half — Resume (paste, upload, or drag & drop) */}
      <div
        className="relative flex-1 flex flex-col min-h-0"
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
              disabled={isExtracting}
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

        <div className={wellClass(isDragActive)}>
          <textarea
            value={resumeText}
            onChange={(event) => onResumeChange(event.target.value)}
            placeholder={t.resumePlaceholder}
            spellCheck={false}
            aria-label={t.resumeLabel}
            className="flex-1 w-full min-h-0 rounded-xl px-4 py-3 text-sm leading-relaxed text-charcoal bg-transparent border-none outline-none placeholder:text-charcoal/35"
          />
        </div>

        {isDragActive && (
          <div className="absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cobalt bg-white/85 backdrop-blur-sm pointer-events-none animate-fade-in">
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
      <div className="flex-1 flex flex-col min-h-0">
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
        <div className={wellClass()}>
          <textarea
            value={jobDescriptionText}
            onChange={(event) => onJobDescriptionChange(event.target.value)}
            placeholder={t.jobPlaceholder}
            spellCheck={false}
            aria-label={t.jobLabel}
            className="flex-1 w-full min-h-0 rounded-xl px-4 py-3 text-sm leading-relaxed text-charcoal bg-transparent border-none outline-none placeholder:text-charcoal/35"
          />
        </div>
      </div>

      {/* Action bar pinned to the bottom */}
      <div className="px-4 py-4 bg-surface/60 border-t border-hairline">
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
              <span>{t.analyze}</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
