import type { DraftDocument, Mode } from "../types";
import { parseDraft } from "./draftStructure";
import { PAGE } from "./letterLayout";

export const DOCUMENT_FONTS = [
  { label: "Arial", family: "Align Arial", file: "LiberationSans", word: "Arial" },
  { label: "Times New Roman", family: "Align Times", file: "Tinos", word: "Times New Roman" },
  { label: "Calibri", family: "Align Calibri", file: "Carlito", word: "Calibri" },
] as const;
export const CONTENT_HEIGHT = PAGE.height - PAGE.top - PAGE.bottom;
export const PX_TO_PT = 0.75;

/** Import plain text once. Later edits preserve every paragraph and hard break. */
export function documentFromText(text: string, mode: Mode): DraftDocument {
  const blocks = parseDraft(text, mode);
  return { type: "doc", content: text.replace(/\r\n?/g, "\n").split("\n").map((line) => {
    const block = blocks.find((candidate) => candidate.text.split("\n").includes(line.trim()));
    return { type: "paragraph", attrs: { textAlign: block?.kind === "sender" || block?.kind === "date" ? "right" : "left" },
      content: line ? [{ type: "text", text: line.replace(/^\*\*|\*\*$/g, ""),
        marks: block?.kind === "subject" ? [{ type: "bold" }] : [] }] : [] };
  }) };
}

export interface DocumentGlyph {
  text: string;
  x: number;
  baseline: number;
  size: number;
  font: number;
  bold: boolean;
}
export interface DocumentLine {
  top: number;
  height: number;
  alignment: "left" | "center" | "right";
  glyphs: DocumentGlyph[];
  page: number;
  y: number;
}
export interface DocumentSnapshot { lines: DocumentLine[]; pages: number; breaks: number[] }

/** Paginate whole lines without resizing text or dropping blank lines. */
export function paginateLines(lines: Omit<DocumentLine, "page" | "y">[]): DocumentSnapshot {
  let page = 0;
  let origin = 0;
  const breaks: number[] = [];
  const result = lines.map((line): DocumentLine => {
    if (line.top - origin + line.height > CONTENT_HEIGHT + 0.5 && line.top > origin) {
      page++;
      origin = line.top;
      breaks.push(line.top);
    }
    return { ...line, page, y: line.top - origin };
  });
  return { lines: result, pages: page + 1, breaks };
}

/** Read the browser's actual glyph positions, so PDF uses the editor's wrapping. */
export function snapshotEditor(root: HTMLElement): DocumentSnapshot {
  const rootBox = root.getBoundingClientRect();
  const scale = rootBox.width / root.offsetWidth || 1;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const lines: Omit<DocumentLine, "page" | "y">[] = [];
  for (const paragraph of Array.from(root.children) as HTMLElement[]) {
    const style = getComputedStyle(paragraph);
    const alignment = (["center", "right"].includes(style.textAlign) ? style.textAlign : "left") as DocumentLine["alignment"];
    const lineHeight = parseFloat(style.lineHeight) * PX_TO_PT;
    const pBox = paragraph.getBoundingClientRect();
    const byLine = new Map<number, Omit<DocumentLine, "page" | "y">>();
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement!;
      const runStyle = getComputedStyle(parent);
      const sizePx = parseFloat(runStyle.fontSize);
      const runLineHeight = parseFloat(runStyle.lineHeight) * PX_TO_PT;
      const font = Math.max(0, DOCUMENT_FONTS.findIndex((item) => runStyle.fontFamily.includes(item.family)));
      const bold = parseInt(runStyle.fontWeight) >= 600;
      context.font = `${bold ? "bold " : ""}${sizePx}px "${DOCUMENT_FONTS[font].family}"`;
      const metrics = context.measureText("Mg");
      const descent = metrics.fontBoundingBoxDescent ?? sizePx * 0.22;
      const text = node.textContent ?? "";
      for (let i = 0; i < text.length;) {
        const char = String.fromCodePoint(text.codePointAt(i)!);
        const range = document.createRange();
        range.setStart(node, i); range.setEnd(node, i + char.length);
        const rect = range.getBoundingClientRect();
        i += char.length;
        if (!rect.height) continue;
        // Use baseline to group mixed font sizes on the same visual line.
        const baseline = ((rect.bottom - rootBox.top) / scale - descent) * PX_TO_PT;
        const existingKey = [...byLine.keys()].find((key) => Math.abs(key - baseline) < 1);
        const key = existingKey ?? baseline;
        if (!byLine.has(key)) byLine.set(key, { top: (rect.top - rootBox.top) / scale * PX_TO_PT, height: Math.max(lineHeight, runLineHeight, rect.height / scale * PX_TO_PT), alignment, glyphs: [] });
        const line = byLine.get(key)!;
        line.height = Math.max(line.height, runLineHeight);
        line.top = Math.min(line.top, (rect.top - rootBox.top) / scale * PX_TO_PT);
        line.height = Math.max(line.height, (rect.bottom - rootBox.top) / scale * PX_TO_PT - line.top);
        line.glyphs.push({ text: char, x: (rect.left - rootBox.left) / scale * PX_TO_PT, baseline, size: sizePx * PX_TO_PT, font, bold });
      }
    }
    // Include empty paragraphs and hard-break lines in the document's height.
    const rows = [...byLine.values()].sort((a, b) => a.top - b.top);
    const pTop = (pBox.top - rootBox.top) / scale * PX_TO_PT;
    const pHeight = pBox.height / scale * PX_TO_PT;
    let cursor = pTop;
    for (const row of rows) {
      while (row.top - cursor >= lineHeight - 1) {
        lines.push({ top: cursor, height: lineHeight, alignment, glyphs: [] }); cursor += lineHeight;
      }
      lines.push(row);
      cursor = Math.max(cursor, row.top + row.height);
    }
    while (cursor < pTop + pHeight - 1) {
      lines.push({ top: cursor, height: lineHeight, alignment, glyphs: [] }); cursor += lineHeight;
    }
  }
  return paginateLines(lines);
}

export async function loadDocumentFonts() {
  await Promise.all(DOCUMENT_FONTS.flatMap((font) => [400, 700].map((weight) => document.fonts.load(`${weight} 11pt "${font.family}"`))));
}

/** Normalize Word/web paste styles to the fonts and sizes this editor exports. */
export function normalizePastedHTML(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const element of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    const style = element.style;
    if (style.fontFamily) {
      const family = style.fontFamily.toLowerCase();
      const font = DOCUMENT_FONTS.find((candidate) => family.includes(candidate.family.toLowerCase()) || family.includes(candidate.label.toLowerCase())) ?? DOCUMENT_FONTS[0];
      style.fontFamily = `"${font.family}"`;
    }
    if (style.fontSize) {
      const number = parseFloat(style.fontSize);
      const points = style.fontSize.endsWith("px") ? number * PX_TO_PT : number;
      style.fontSize = Number.isFinite(points) ? `${Math.max(9, Math.min(24, Math.round(points * 2) / 2))}pt` : "11pt";
    }
    if (style.textAlign && !["left", "center", "right"].includes(style.textAlign)) style.textAlign = "left";
  }
  return document.body.innerHTML;
}
