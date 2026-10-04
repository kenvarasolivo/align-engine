import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import { AlignLeft, AlignCenter, AlignRight, Bold, Undo2, Redo2, Download, Eye, X } from "lucide-react";
import type { DraftDocument, Language, Mode } from "../types";
import { documentFromText, DOCUMENT_FONTS, loadDocumentFonts, normalizePastedHTML, snapshotEditor, type DocumentSnapshot } from "../lib/richDraft";
import { PAGE, ExportError } from "../lib/letterLayout";

interface Props {
  draft: string;
  document: DraftDocument | null;
  onChange: (text: string, document: DraftDocument) => void;
  mode: Mode;
  language: Language;
  isLoading: boolean;
}

export default function RichDraftEditor({ draft, document: value, onChange, mode, language, isLoading }: Props) {
  const de = language === "de";
  const viewport = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDialogElement>(null);
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<DocumentSnapshot | null>(null);
  const [width, setWidth] = useState(600);
  const [paperHeight, setPaperHeight] = useState(PAGE.height / 0.75);
  const [zoom, setZoom] = useState("fit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const lock = useRef(false);
  const emittedDocuments = useRef(new WeakSet<DraftDocument>());
  const paperWidth = PAGE.width / 0.75;
  const scale = zoom === "fit" ? Math.min(1, Math.max(0.25, (width - 32) / paperWidth)) : Number(zoom) / 100;

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, italic: false, strike: false, underline: false, link: false }),
      TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right"] }), TextStyle, FontFamily, FontSize],
    content: value ?? documentFromText(draft, mode),
    editorProps: { transformPastedHTML: normalizePastedHTML, attributes: { class: "rich-letter-content", role: "textbox", "aria-label": de ? "Entwurfseditor" : "Draft editor", "aria-multiline": "true", spellcheck: "true" } },
    onUpdate: ({ editor: current }) => {
      const document = current.getJSON();
      emittedDocuments.current.add(document);
      onChange(current.getText({ blockSeparator: "\n" }), document);
      setRevision((number) => number + 1);
    },
  });

  useEffect(() => {
    if (!editor) return;
    // Parent echoes must not reset the live selection when typing quickly.
    if (value && emittedDocuments.current.has(value)) return;
    if (value) {
      if (JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.commands.setContent(value, { emitUpdate: false });
    } else if (editor.getText({ blockSeparator: "\n" }) !== draft) {
      editor.commands.setContent(documentFromText(draft, mode), { emitUpdate: false });
    }
    setRevision((number) => number + 1);
  }, [editor, draft, value, mode]);

  useEffect(() => { editor?.setEditable(!isLoading && !busy); }, [editor, isLoading, busy]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      loadDocumentFonts().then(() => {
        if (cancelled || editor.isDestroyed) return;
        const measured = snapshotEditor(editor.view.dom);
        setSnapshot(measured);
        setPaperHeight(Math.max(PAGE.height / 0.75, editor.view.dom.offsetHeight + (PAGE.top + PAGE.bottom) / 0.75));
      }).catch(() => { if (!cancelled) setError(de ? "Schriften konnten nicht geladen werden." : "Could not load document fonts."); });
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [editor, revision, scale, de]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { if (previewUrl) preview.current?.showModal(); }, [previewUrl]);

  const runExport = async (action: "pdf" | "word" | "preview") => {
    if (!editor || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await loadDocumentFonts();
      const measured = snapshotEditor(editor.view.dom);
      setSnapshot(measured);
      const exporter = await import("../lib/richDraftExport");
      const bytes = action === "word" ? await exporter.makeRichWord(measured, language)
        : await exporter.makeRichPdf(measured, await exporter.loadRichExportFonts());
      if (action === "preview") {
        setPreviewUrl(URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" })));
      } else {
        const { saveDownload, exportFilename, parseDraft } = await import("../lib/draftExport");
        const filename = exportFilename({ blocks: parseDraft(draft, mode).map((block) => ({ ...block, lines: [], after: 0 })), fontSize: 11, lineHeight: 14.96, height: 0 }, mode, language);
        saveDownload(bytes, action === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", `${filename}.${action === "pdf" ? "pdf" : "docx"}`);
      }
    } catch (failure) {
      setError(failure instanceof ExportError && failure.code === "characters"
        ? (de ? "Bitte Emojis oder nicht unterstützte Zeichen ersetzen." : "Replace emoji or unsupported characters before exporting.")
        : (de ? "Export fehlgeschlagen. Bitte erneut versuchen." : "Could not export. Please try again."));
    } finally { lock.current = false; setBusy(false); }
  };

  const button = "btn-secondary min-h-9 px-2.5 text-xs";
  const disabled = busy || isLoading;
  const closePreview = () => { preview.current?.close(); setPreviewUrl(null); };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface/40 px-4 py-3" role="toolbar" aria-label={de ? "Textformatierung" : "Text formatting"}>
        <select aria-label={de ? "Schriftart" : "Font"} disabled={disabled} className="focus-ring h-9 max-w-40 rounded-lg border border-hairline bg-panel px-2 text-xs"
          value={String(editor?.getAttributes("textStyle").fontFamily ?? DOCUMENT_FONTS[0].family).replace(/["']/g, "")}
          onChange={(event) => editor?.chain().focus().setFontFamily(event.target.value).run()}>
          {DOCUMENT_FONTS.map((font) => <option key={font.family} value={font.family}>{font.label}</option>)}
        </select>
        <select aria-label={de ? "Schriftgröße" : "Font size"} disabled={disabled} className="focus-ring h-9 rounded-lg border border-hairline bg-panel px-2 text-xs"
          value={editor?.getAttributes("textStyle").fontSize ?? "11pt"}
          onChange={(event) => editor?.chain().focus().setFontSize(event.target.value).run()}>
          {[9, 10, 10.5, 11, 11.5, 12, 14, 16, 18, 20, 24].map((size) => <option key={size} value={`${size}pt`}>{size} pt</option>)}
        </select>
        <button type="button" aria-label={de ? "Fett" : "Bold"} aria-pressed={editor?.isActive("bold") ?? false} disabled={disabled}
          className={`${button} ${editor?.isActive("bold") ? "!text-cobalt !border-cobalt" : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
        {([{ value: "left", en: "Align left", de: "Linksbündig", Icon: AlignLeft }, { value: "center", en: "Align center", de: "Zentriert", Icon: AlignCenter }, { value: "right", en: "Align right", de: "Rechtsbündig", Icon: AlignRight }] as const).map(({ value: alignment, en, de: label, Icon }) => (
          <button key={alignment} type="button" aria-label={de ? label : en} aria-pressed={editor?.isActive({ textAlign: alignment }) ?? false} disabled={disabled}
            className={`${button} ${editor?.isActive({ textAlign: alignment }) ? "!text-cobalt !border-cobalt" : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().setTextAlign(alignment).run()}><Icon size={16} /></button>
        ))}
        <button type="button" aria-label={de ? "Rückgängig" : "Undo"} disabled={disabled || !editor?.can().undo()} className={button} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={16} /></button>
        <button type="button" aria-label={de ? "Wiederholen" : "Redo"} disabled={disabled || !editor?.can().redo()} className={button} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={16} /></button>
        <select aria-label="Zoom" value={zoom} onChange={(event) => setZoom(event.target.value)} className="focus-ring ml-auto h-9 rounded-lg border border-hairline bg-panel px-2 text-xs">
          <option value="fit">{de ? "Einpassen" : "Fit page"}</option>{[50, 75, 100, 125].map((number) => <option key={number} value={number}>{number}%</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2">
        <p role="status" className={`text-xs ${snapshot && snapshot.pages > 1 ? "font-semibold text-warning-strong" : "text-charcoal/60"}`}>
          {busy ? (de ? "Export wird vorbereitet…" : "Preparing export…") : snapshot && snapshot.pages > 1
            ? (de ? `${snapshot.pages} A4-Seiten · Entwurf überschreitet eine Seite` : `${snapshot.pages} A4 pages · Draft exceeds one page`)
            : (de ? "1 A4-Seite" : "1 A4 page")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={disabled || !draft.trim()} onClick={() => void runExport("preview")}><Eye size={14} />{de ? "PDF-Vorschau" : "PDF preview"}</button>
          <button type="button" className={`${button} !text-cobalt`} disabled={disabled || !draft.trim()} onClick={() => void runExport("pdf")}><Download size={14} />PDF</button>
          <button type="button" className={button} disabled={disabled || !draft.trim()} onClick={() => void runExport("word")}><Download size={14} />Word</button>
        </div>
      </div>
      {error && <p role="alert" className="border-b border-danger-border bg-danger-soft px-4 py-2 text-xs text-danger-strong">{error}</p>}
      <div ref={viewport} className="min-h-0 flex-1 overflow-auto bg-surface-sunken p-4">
        <div style={{ width: paperWidth * scale, height: paperHeight * scale, margin: "0 auto" }}>
          <div className="rich-letter-page relative" style={{ width: paperWidth, minHeight: PAGE.height / 0.75, padding: `${PAGE.top / 0.75}px ${PAGE.right / 0.75}px ${PAGE.bottom / 0.75}px ${PAGE.left / 0.75}px`, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <EditorContent editor={editor} />
            {snapshot?.breaks.map((top, index) => <div key={index} className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-red-400 text-right" style={{ top: (PAGE.top + top) / 0.75 }}>
              <span className="relative -top-5 mr-2 bg-white px-1 text-[10px] text-red-600">{de ? "Seite" : "Page"} {index + 2}</span>
            </div>)}
          </div>
        </div>
      </div>
      <p className="border-t border-hairline px-4 py-2 text-[11px] text-charcoal/50">{de ? "Enter: neuer Absatz · Umschalt + Enter: Zeilenumbruch. Formatierung und Umbrüche werden ins PDF übernommen." : "Enter: new paragraph · Shift + Enter: line break. Formatting and line breaks carry through to PDF."}</p>
      <dialog ref={preview} onCancel={(event) => { event.preventDefault(); closePreview(); }} className="letter-preview-dialog rounded-2xl border border-hairline bg-panel p-0 text-charcoal" aria-label={de ? "PDF-Vorschau" : "PDF preview"}>
        <div className="flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold">{de ? "PDF-Vorschau" : "PDF preview"}</span><button type="button" className="focus-ring rounded-lg p-2" aria-label={de ? "Schließen" : "Close preview"} onClick={closePreview}><X size={20} /></button></div>
        {previewUrl && <iframe title={de ? "Fertiges Dokument" : "Finished document"} src={previewUrl} className="h-[75vh] w-full border-0" />}
      </dialog>
    </div>
  );
}
