import { PDFDocument, type PDFFont, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Language, Mode } from "../types";
import { ExportError, PAGE, type BlockKind, type LetterBlock, type LayoutBlock, type LetterLayout } from "./letterLayout";
export { ExportError, PAGE } from "./letterLayout";
export type { LetterLayout } from "./letterLayout";
const CONTENT_WIDTH = PAGE.width - PAGE.left - PAGE.right;
const CONTENT_HEIGHT = PAGE.height - PAGE.top - PAGE.bottom - 20; // Word pagination safety margin.
const subjectPattern = /^(?:\*\*)?(?:Bewerbung\b|Application\b|Betreff\s*:|Subject\s*:)/i;
const salutationPattern = /^(?:Sehr geehrt|Liebe[rs]?\b|Guten Tag\b|Dear\b|Hello\b|Hi\b|To whom)/i;
const closingPattern = /^(?:Mit freundlichen Grüßen|Mit freundlichen Gruessen|Freundliche Grüße|Beste Grüße|Kind regards|Best regards|Yours sincerely|Yours faithfully|Sincerely)\b/i;
const datePattern = /^(?:\[(?:Datum|Date)\]|(?:Datum|Date)\s*:|.*\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|.*\b\d{4}-\d{2}-\d{2}\b|.*\b\d{1,2}\.?\s+(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|January|February|March|May|June|July|October|December)\s+\d{4}\b)/i;

/** Interpret the plain-text structure requested by the generator; never infer personal details. */
export function parseDraft(draft: string, mode: Mode): LetterBlock[] {
  const texts = draft.replace(/\r\n?/g, "\n").trim().split(/\n[\t ]*\n+/).flatMap(block => {
    // Also recognize a subject or sign-off when the editor has only a single newline before it.
    const parts: string[] = [];
    let lines: string[] = [];
    for (const line of block.split("\n")) {
      if (lines.length && (subjectPattern.test(line.trim()) || closingPattern.test(line.trim()))) {
        parts.push(lines.join("\n"));
        lines = [];
      }
      lines.push(line);
    }
    if (lines.length) parts.push(lines.join("\n"));
    return parts;
  }).map(s => s.trim()).filter(Boolean);
  const subject = texts.findIndex(s => subjectPattern.test(s));
  const greeting = texts.findIndex(s => salutationPattern.test(s));
  const headerEnd = subject >= 0 ? subject : greeting;
  let headerCount = 0;
  return texts.map((text, index) => {
    let kind: BlockKind = "body";
    if (index === subject) {
      kind = "subject";
      text = text.replace(/^\*\*|\*\*$/g, "");
    } else if (closingPattern.test(text)) {
      kind = "closing";
    } else if (mode === "anschreiben" && (greeting < 0 || index < greeting) && datePattern.test(text) && !text.includes("\n")) {
      kind = "date";
    } else if (mode === "anschreiben" && headerEnd >= 0 && index < headerEnd) {
      kind = headerCount++ === 0 ? "sender" : "recipient";
    }
    return { text, kind };
  });
}

/** Wrap using the embedded PDF font's actual metrics, with room for Word's Arial metrics. */
function wrap(text: string, font: PDFFont, size: number): string[] {
  const limit = CONTENT_WIDTH - 10;
  const lines: string[] = [];
  for (const sourceLine of text.split("\n")) {
    let current = "";
    for (const word of sourceLine.trim().split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= limit) { current = candidate; continue; }
      if (current) { lines.push(current); current = ""; }
      // Long URLs/identifiers must also wrap instead of crossing the page edge.
      for (const char of word) {
        if (current && font.widthOfTextAtSize(current + char, size) > limit) { lines.push(current); current = ""; }
        current += char;
      }
    }
    lines.push(current);
  }
  return lines;
}

export function fitLetter(blocks: LetterBlock[], regular: PDFFont, bold: PDFFont): LetterLayout {
  if (!blocks.length) throw new ExportError("empty");
  const regularChars = new Set(regular.getCharacterSet());
  const boldChars = new Set(bold.getCharacterSet());
  for (const block of blocks) {
    for (const char of block.text) {
      if (char === "\n" || char === "\t") continue;
      const code = char.codePointAt(0)!;
      if (!regularChars.has(code) || !boldChars.has(code)) throw new ExportError("characters");
    }
  }
  // Prefer spacious typography, then tighten spacing, then reduce font size. Never cut content.
  for (const fontSize of [11.5, 11, 10.5, 10]) {
    for (const compact of [false, true]) {
      const lineHeight = fontSize * (compact ? 1.22 : 1.36);
      const layoutBlocks = blocks.map((block, index): LayoutBlock => {
        const lines = block.text.split("\n").flatMap((line, i) => {
          const isBold = block.kind === "subject" || ((block.kind === "sender" || block.kind === "recipient") && i === 0);
          return wrap(line, isBold ? bold : regular, fontSize).map(text => ({ text, bold: isBold }));
        });
        const gap = block.kind === "subject" ? 16 : block.kind === "sender" || block.kind === "recipient" ? 14 : 10;
        const next = blocks[index + 1];
        // Keep a clear blank line before the subject and sign-off, even in compact layouts.
        const sectionGap = next?.kind === "subject" || next?.kind === "closing";
        const after = sectionGap ? Math.max(24, lineHeight * 1.5) : compact ? gap * 0.65 : gap;
        return { ...block, lines, after: index === blocks.length - 1 ? 0 : after };
      });
      const height = layoutBlocks.reduce((sum, block) => sum + block.lines.length * lineHeight + block.after, 0);
      if (height <= CONTENT_HEIGHT) return { blocks: layoutBlocks, fontSize, lineHeight, height };
    }
  }
  throw new ExportError("overflow");
}

export interface ExportFonts { regular: Uint8Array; bold: Uint8Array }
let fontPromise: Promise<ExportFonts> | undefined;
export function loadExportFonts(): Promise<ExportFonts> {
  if (!fontPromise) {
    const load = async (name: string) => {
      const response = await fetch(`${import.meta.env.BASE_URL}fonts/LiberationSans-${name}.ttf`);
      if (!response.ok) throw new ExportError("fonts");
      return new Uint8Array(await response.arrayBuffer());
    };
    fontPromise = Promise.all([load("Regular"), load("Bold")]).then(([regular, bold]) => ({ regular, bold })).catch(error => {
      fontPromise = undefined;
      throw error;
    });
  }
  return fontPromise;
}

export async function prepareLetter(draft: string, mode: Mode, fonts: ExportFonts) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const layout = fitLetter(parseDraft(draft, mode), regular, bold);
  return { pdf, regular, bold, layout };
}

export async function makePdf(prepared: Awaited<ReturnType<typeof prepareLetter>>): Promise<Uint8Array> {
  const { pdf, regular, bold, layout } = prepared;
  pdf.setTitle(layout.blocks.find(block => block.kind === "subject")?.text ?? "Cover letter");
  pdf.setCreator("ALIGN");
  const page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.top - layout.fontSize;
  for (const block of layout.blocks) {
    for (const line of block.lines) {
      const font = line.bold ? bold : regular;
      const right = block.kind === "sender" || block.kind === "date";
      const x = right ? PAGE.width - PAGE.right - font.widthOfTextAtSize(line.text, layout.fontSize) : PAGE.left;
      if (line.text) page.drawText(line.text, { x, y, size: layout.fontSize, font, color: rgb(0.06, 0.06, 0.06) });
      y -= layout.lineHeight;
    }
    y -= block.after;
  }
  return pdf.save();
}

export async function makeWord(layout: LetterLayout, language: Language): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, LineRuleType } = await import("docx");
  const twips = (points: number) => Math.round(points * 20);
  const document = new Document({
    creator: "ALIGN",
    title: layout.blocks.find(block => block.kind === "subject")?.text ?? "Cover letter",
    styles: { default: { document: { run: { font: "Arial", size: layout.fontSize * 2, color: "111111", language: { value: language === "de" ? "de-DE" : "en-GB" } } } } },
    sections: [{
      properties: { page: { size: { width: twips(PAGE.width), height: twips(PAGE.height) }, margin: { top: twips(PAGE.top), bottom: twips(PAGE.bottom), left: twips(PAGE.left), right: twips(PAGE.right) } } },
      children: layout.blocks.map(block => new Paragraph({
        alignment: block.kind === "sender" || block.kind === "date" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { before: 0, after: twips(block.after), line: twips(layout.lineHeight), lineRule: LineRuleType.EXACT },
        widowControl: false,
        children: block.lines.map((line, index) => new TextRun({ text: line.text, bold: line.bold, break: index === 0 ? undefined : 1 })),
      })),
    }],
  });
  return new Uint8Array(await Packer.toArrayBuffer(document));
}

export function exportFilename(layout: LetterLayout, mode: Mode, language: Language): string {
  if (mode === "anschreiben") {
    const firstLine = (kind: BlockKind) => layout.blocks.find(block => block.kind === kind)?.text.split("\n")[0];
    const closing = layout.blocks.find(block => block.kind === "closing")?.text.split("\n").map(line => line.trim()).filter(Boolean);
    const applicant = firstLine("sender") ?? (closing && closing.length > 1 ? closing[closing.length - 1] : undefined);
    const cleanPart = (value: string | undefined) => {
      if (!value || /\[.*\]/.test(value)) return "";
      return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim().replace(/\s+/g, "_").replace(/[._]+$/, "").slice(0, 60);
    };
    return ["Anschreiben", cleanPart(firstLine("recipient")), cleanPart(applicant)].filter(Boolean).join("_");
  }
  const subject = layout.blocks.find(block => block.kind === "subject")?.text;
  const fallback = mode === "email" ? "Email" : language === "de" ? "Anschreiben" : "Cover letter";
  return (subject ?? fallback).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 100).replace(/[. ]+$/, "") || fallback;
}

export function saveDownload(bytes: Uint8Array, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
