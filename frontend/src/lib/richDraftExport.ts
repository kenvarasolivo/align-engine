import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { DOCUMENT_FONTS, type DocumentSnapshot } from "./richDraft";
import { ExportError, PAGE } from "./letterLayout";
import type { Language } from "../types";

let fontBytes: Promise<Uint8Array[][]> | undefined;
export function loadRichExportFonts(): Promise<Uint8Array[][]> {
  if (!fontBytes) fontBytes = Promise.all(DOCUMENT_FONTS.map((font) => Promise.all(["Regular", "Bold"].map(async (weight) => {
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/${font.file}-${weight}.ttf`);
    if (!response.ok) throw new ExportError("fonts");
    return new Uint8Array(await response.arrayBuffer());
  })))).catch((error) => { fontBytes = undefined; throw error; });
  return fontBytes;
}

export async function makeRichPdf(snapshot: DocumentSnapshot, bytes: Uint8Array[][]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await Promise.all(bytes.map((pair) => Promise.all(pair.map((data) => pdf.embedFont(data, { subset: true })))));
  const pages = Array.from({ length: snapshot.pages }, () => pdf.addPage([PAGE.width, PAGE.height]));
  pdf.setCreator("ALIGN");
  for (const line of snapshot.lines) {
    for (const glyph of line.glyphs) {
      const font = fonts[glyph.font][glyph.bold ? 1 : 0];
      if (!font.getCharacterSet().includes(glyph.text.codePointAt(0)!)) throw new ExportError("characters");
      pages[line.page].drawText(glyph.text, {
        x: PAGE.left + glyph.x,
        y: PAGE.height - PAGE.top - line.y - (glyph.baseline - line.top),
        size: glyph.size, font, color: rgb(0.067, 0.067, 0.067),
      });
    }
  }
  return pdf.save();
}

export async function makeRichWord(snapshot: DocumentSnapshot, language: Language): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, LineRuleType } = await import("docx");
  const twips = (value: number) => Math.round(value * 20);
  const document = new Document({ creator: "ALIGN", sections: [{
    properties: { page: { size: { width: twips(PAGE.width), height: twips(PAGE.height) }, margin: { top: twips(PAGE.top), bottom: twips(PAGE.bottom), left: twips(PAGE.left), right: twips(PAGE.right) } } },
    children: snapshot.lines.map((line, index) => {
      const previous = snapshot.lines[index - 1];
      const runs: { text: string; font: string; bold: boolean; size: number }[] = [];
      for (const glyph of line.glyphs) {
        const font = DOCUMENT_FONTS[glyph.font].word;
        const last = runs[runs.length - 1];
        if (last && last.font === font && last.bold === glyph.bold && last.size === glyph.size * 2) last.text += glyph.text;
        else runs.push({ text: glyph.text, font, bold: glyph.bold, size: glyph.size * 2 });
      }
      return new Paragraph({ alignment: line.alignment, widowControl: false,
        pageBreakBefore: previous ? previous.page !== line.page : false,
        spacing: { before: twips(previous && previous.page === line.page ? Math.max(0, line.y - previous.y - previous.height) : line.y), after: 0, line: twips(line.height), lineRule: LineRuleType.EXACT },
        children: runs.length ? runs.map((run) => new TextRun({ ...run, language: { value: language === "de" ? "de-DE" : "en-GB" } })) : [new TextRun({ text: "", size: 22 })],
      });
    }),
  }] });
  return new Uint8Array(await Packer.toArrayBuffer(document));
}
