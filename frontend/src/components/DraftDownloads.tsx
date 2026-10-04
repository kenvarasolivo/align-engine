import { useEffect, useRef, useState } from "react";
import { Download, Eye, X } from "lucide-react";
import type { Language, Mode } from "../types";
import { ExportError, PAGE, type LetterLayout } from "../lib/letterLayout";

const COPY = {
  en: {
    pdf: "Download PDF", word: "Download Word", preview: "Preview", close: "Close preview",
    working: "Preparing download…", onePage: "One A4 page · right-aligned sender · bold subject",
    guide: "Letter formatting", hint: "Separate your sender details, recipient details, date, subject, greeting, body paragraphs and sign-off with a blank line. Put each address line on its own line. Start the subject with Application for, Bewerbung or Subject:. All downloads use your current edits.",
    overflow: "This draft is too long for one readable A4 page. Shorten the text or remove extra address lines, then try again. No content has been removed.",
    characters: "Some characters are unsupported by the export font. Replace emoji or unusual symbols and try again.",
    fonts: "The export fonts could not be loaded. Please try again.", empty: "Add a draft before downloading.", failed: "Could not create the download. Please try again.",
    size: "Text size", page: "1 / 1", emailHint: "One A4 page · bold subject · editable Word document",
  },
  de: {
    pdf: "PDF herunterladen", word: "Word herunterladen", preview: "Vorschau", close: "Vorschau schließen",
    working: "Download wird vorbereitet…", onePage: "Eine A4-Seite · Absender rechtsbündig · Betreff fett",
    guide: "Briefformatierung", hint: "Trennen Sie Absender, Empfänger, Datum, Betreff, Anrede, Absätze und Grußformel durch eine Leerzeile. Schreiben Sie jede Adresszeile in eine eigene Zeile. Beginnen Sie den Betreff mit Bewerbung, Application for oder Betreff:. Downloads enthalten Ihre aktuellen Änderungen.",
    overflow: "Dieser Entwurf ist zu lang für eine gut lesbare A4-Seite. Kürzen Sie den Text oder entfernen Sie zusätzliche Adresszeilen und versuchen Sie es erneut. Es wurde kein Inhalt entfernt.",
    characters: "Die Exportschrift unterstützt einige Zeichen nicht. Ersetzen Sie Emojis oder ungewöhnliche Symbole und versuchen Sie es erneut.",
    fonts: "Die Exportschriften konnten nicht geladen werden. Bitte erneut versuchen.", empty: "Fügen Sie vor dem Download einen Entwurf hinzu.", failed: "Der Download konnte nicht erstellt werden. Bitte erneut versuchen.",
    size: "Schriftgröße", page: "1 / 1", emailHint: "Eine A4-Seite · Betreff fett · bearbeitbares Word-Dokument",
  },
};

export default function DraftDownloads({ draft, mode, language, isLoading }: { draft: string; mode: Mode; language: Language; isLoading: boolean }) {
  const t = COPY[language];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<LetterLayout | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const revision = useRef(0);
  const lock = useRef(false);

  useEffect(() => {
    revision.current++;
    setError(null);
    setLayout(null);
    dialog.current?.close();
    return () => { revision.current++; };
  }, [draft, mode, language]);

  async function run(action: "pdf" | "word" | "preview") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const currentRevision = revision.current;
    try {
      // Keep the large export libraries out of the initial app bundle.
      const exporter = await import("../lib/draftExport");
      const prepared = await exporter.prepareLetter(draft, mode, await exporter.loadExportFonts());
      if (revision.current !== currentRevision) return;
      if (action === "preview") {
        await document.fonts.load(`${prepared.layout.fontSize}pt "Align Letter"`);
        await document.fonts.load(`bold ${prepared.layout.fontSize}pt "Align Letter"`);
        if (revision.current !== currentRevision) return;
        setLayout(prepared.layout);
        dialog.current?.showModal();
      } else {
        const bytes = action === "pdf" ? await exporter.makePdf(prepared) : await exporter.makeWord(prepared.layout, language);
        if (revision.current !== currentRevision) return;
        const mime = action === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        exporter.saveDownload(bytes, mime, `${exporter.exportFilename(prepared.layout, mode, language)}.${action === "pdf" ? "pdf" : "docx"}`);
      }
    } catch (err) {
      if (revision.current === currentRevision) setError(err instanceof ExportError ? t[err.code] : t.failed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const disabled = busy || isLoading || !draft.trim();
  const buttonClass = "focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-charcoal hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
  return (
    <div className="border-b border-hairline px-5 lg:px-6 py-3 bg-surface/40">
      <div className="flex flex-wrap gap-2" aria-busy={busy}>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => run("preview")}><Eye size={14} aria-hidden="true" />{t.preview}</button>
        <button type="button" className={`${buttonClass} !border-cobalt/30 !text-cobalt`} disabled={disabled} onClick={() => run("pdf")}><Download size={14} aria-hidden="true" />{t.pdf}</button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => run("word")}><Download size={14} aria-hidden="true" />{t.word}</button>
      </div>
      <p className="mt-2 text-xs text-charcoal/55" role="status">{busy ? t.working : mode === "anschreiben" ? t.onePage : t.emailHint}</p>
      {mode === "anschreiben" && <details className="mt-1 text-xs text-charcoal/55"><summary className="focus-ring cursor-pointer w-fit rounded">{t.guide}</summary><p className="mt-2 max-w-xl leading-relaxed">{t.hint}</p></details>}
      {error && <p className="mt-2 text-xs leading-relaxed text-danger-strong" role="alert">{error}</p>}
      <dialog ref={dialog} aria-labelledby="letter-preview-title" className="letter-preview-dialog rounded-2xl border border-hairline bg-panel text-charcoal p-0 shadow-card">
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-hairline">
          <div><h2 id="letter-preview-title" className="text-sm font-semibold text-obsidian">{t.preview} · A4 · {t.page}</h2>{layout && <p className="text-xs text-charcoal/55">{t.size}: {layout.fontSize} pt</p>}</div>
          <button type="button" className="focus-ring p-2 rounded-lg hover:bg-surface-sunken" aria-label={t.close} onClick={() => dialog.current?.close()}><X size={20} /></button>
        </div>
        <div className="overflow-auto p-4 bg-surface-sunken" style={{ maxHeight: "75vh" }}>
          {layout && <div className="letter-preview-page" style={{ width: `${PAGE.width}pt`, minHeight: `${PAGE.height}pt`, padding: `${PAGE.top}pt ${PAGE.right}pt ${PAGE.bottom}pt ${PAGE.left}pt`, fontSize: `${layout.fontSize}pt`, lineHeight: `${layout.lineHeight}pt` }}>
            {layout.blocks.map((block, i) => <div key={i} style={{ marginBottom: `${block.after}pt`, textAlign: block.kind === "sender" || block.kind === "date" ? "right" : "left" }}>
              {block.lines.map((line, j) => <div key={j} style={{ height: `${layout.lineHeight}pt`, whiteSpace: "pre", fontWeight: line.bold ? 700 : 400 }}>{line.text || "\u00a0"}</div>)}
            </div>)}
          </div>}
        </div>
      </dialog>
    </div>
  );
}
