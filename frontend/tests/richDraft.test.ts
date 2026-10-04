import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { documentFromText, paginateLines, CONTENT_HEIGHT, DOCUMENT_FONTS, type DocumentLine } from "../src/lib/richDraft";
import { makeRichPdf, makeRichWord } from "../src/lib/richDraftExport";

test("plain text import preserves all blank lines and gives the subject and header their defaults", () => {
  const text = "Jane\nStreet\n\nAcme\nPersonalabteilung\n\nBewerbung als Engineer\n\n\nSehr geehrte Damen und Herren,\n\nBody.\n";
  const document = documentFromText(text, "anschreiben");
  assert.equal(document.content?.length, text.split("\n").length);
  assert.equal(document.content?.[0].attrs?.textAlign, "right");
  assert.equal(document.content?.[3].attrs?.textAlign, "left");
  assert.equal(document.content?.[6].content?.[0].marks?.[0].type, "bold");
  assert.equal(document.content?.at(-1)?.content?.length, 0);
});

test("pagination keeps complete lines and blank paragraphs at their chosen size", () => {
  const lines = [
    { top: 0, height: 16, alignment: "right" as const, glyphs: [] },
    { top: CONTENT_HEIGHT - 10, height: 16, alignment: "center" as const, glyphs: [] },
    { top: CONTENT_HEIGHT + 6, height: 16, alignment: "left" as const, glyphs: [] },
  ];
  const result = paginateLines(lines);
  assert.equal(result.pages, 2);
  assert.deepEqual(result.lines.map((line) => line.page), [0, 1, 1]);
  assert.deepEqual(result.lines.map((line) => line.y), [0, 0, 16]);
  assert.equal(result.lines[1].height, 16);
});

test("rich exports retain mixed fonts, sizes, bold, alignment, blank lines and multiple pages", async () => {
  const fonts = await Promise.all(DOCUMENT_FONTS.map((font) => Promise.all(["Regular", "Bold"].map(async (weight) => new Uint8Array(await readFile(new URL(`../public/fonts/${font.file}-${weight}.ttf`, import.meta.url)))))));
  const line = (text: string, top: number, font: number, bold: boolean, size: number, alignment: DocumentLine["alignment"]) => ({
    top, height: size * 1.36, alignment,
    glyphs: [...text].map((char, index) => ({ text: char, x: index * 8, baseline: top + size, size, font, bold })),
  });
  const snapshot = paginateLines([
    line("Arial", 0, 0, false, 11, "right"),
    line("", 16, 0, false, 11, "left"),
    line("Times", 32, 1, true, 14, "center"),
    line("Calibri", CONTENT_HEIGHT, 2, true, 12, "left"),
  ]);
  const pdf = await PDFDocument.load(await makeRichPdf(snapshot, fonts));
  assert.equal(pdf.getPageCount(), 2);
  const zip = await JSZip.loadAsync(await makeRichWord(snapshot, "de"));
  const xml = await zip.file("word/document.xml")!.async("string");
  for (const name of ["Arial", "Times New Roman", "Calibri"]) assert.ok(xml.includes(name));
  for (const value of ["center", "right"]) assert.ok(xml.includes(`w:val="${value}"`));
  assert.ok(xml.includes('w:sz w:val="28"'));
  assert.ok(xml.includes("w:pageBreakBefore"));
  assert.ok(xml.includes("w:b"));
});
