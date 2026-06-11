import { useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Language } from "../App";

interface InputPanelProps {
  language: Language;
  resumeText: string;
  onResumeChange: (value: string) => void;
  jobDescriptionText: string;
  onJobDescriptionChange: (value: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  error: string | null;
}

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt";

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
    uploadFailed: string;
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
    uploadFailed: "Could not read the file.",
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
    uploadFailed: "Die Datei konnte nicht gelesen werden.",
  },
};

export default function InputPanel({
  language,
  resumeText,
  onResumeChange,
  jobDescriptionText,
  onJobDescriptionChange,
  onAnalyze,
  isLoading,
  error,
}: InputPanelProps) {
  const t = STRINGS[language];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const canSubmit = !isLoading && resumeText.trim().length > 0 && jobDescriptionText.trim().length > 0;

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

  return (
    <section className="flex flex-col h-full overflow-hidden bg-white border-r-[1px] border-hairline">
      {/* Top half — Resume (paste, upload, or drag & drop) */}
      <div
        className={`relative flex-1 flex flex-col min-h-0 transition-all duration-200 ${
          isDragActive ? "bg-cobalt/5" : ""
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-charcoal/50 select-none">
            {t.resumeLabel}
          </span>

          <div className="flex items-center gap-2 min-w-0">
            {uploadError && (
              <span className="text-xs text-red-600 truncate" role="alert">
                {uploadError}
              </span>
            )}
            {!uploadError && uploadedFileName && !isExtracting && (
              <span className="text-xs text-charcoal/50 truncate max-w-[180px]">{uploadedFileName}</span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border-[1px] border-hairline bg-white transition-all duration-200 ${
                isExtracting
                  ? "text-cobalt"
                  : "text-charcoal/70 hover:text-cobalt hover:border-cobalt/40"
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

        <textarea
          value={resumeText}
          onChange={(event) => onResumeChange(event.target.value)}
          placeholder={t.resumePlaceholder}
          spellCheck={false}
          className="flex-1 w-full min-h-0 px-6 py-2 text-sm leading-relaxed text-charcoal bg-transparent border-none outline-none placeholder:text-charcoal/30"
        />

        {isDragActive && (
          <div className="absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-cobalt bg-white/80 pointer-events-none">
            <span className="text-sm font-medium text-cobalt">{t.dropHint}</span>
          </div>
        )}
      </div>

      {/* Hairline divider */}
      <div className="border-t-[1px] border-hairline" />

      {/* Bottom half — Job Description */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-charcoal/50 select-none">
            {t.jobLabel}
          </span>
        </div>
        <textarea
          value={jobDescriptionText}
          onChange={(event) => onJobDescriptionChange(event.target.value)}
          placeholder={t.jobPlaceholder}
          spellCheck={false}
          className="flex-1 w-full min-h-0 px-6 py-2 text-sm leading-relaxed text-charcoal bg-transparent border-none outline-none placeholder:text-charcoal/30"
        />
      </div>

      {/* Action bar pinned to the bottom */}
      <div className="px-6 py-4 bg-surface border-t-[1px] border-hairline">
        {error && (
          <p className="mb-3 text-xs leading-snug text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canSubmit}
          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-cobalt text-white text-sm font-semibold transition-all duration-200 hover:bg-cobalt-hover active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
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
            <span>{t.analyze}</span>
          )}
        </button>
      </div>
    </section>
  );
}
