import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { parseDraft, prepareLetter, makePdf, makeWord, exportFilename, ExportError, PAGE } from "../src/lib/draftExport";

const fonts = {
  regular: new Uint8Array(await readFile(new URL("../public/fonts/LiberationSans-Regular.ttf", import.meta.url))),
  bold: new Uint8Array(await readFile(new URL("../public/fonts/LiberationSans-Bold.ttf", import.meta.url))),
};
export const germanDraft = `Erika Müller
Schillerstraße 88
52064 Aachen
erika@example.com
+49 123 456789

Beispiel GmbH
Personalabteilung
Bayenstraße 65
50678 Köln

Aachen, 04.10.2026

Bewerbung für ein Pflichtpraktikum im Bereich Frontend Engineering

Sehr geehrte Damen und Herren,

als Informatikstudentin an der FH Aachen möchte ich meine Erfahrung in der Entwicklung moderner Webanwendungen in Ihr Team einbringen. Besonders interessiert mich die Arbeit an zugänglichen Benutzeroberflächen, die komplexe Daten verständlich darstellen und im Alltag zuverlässig funktionieren. Während meines Studiums habe ich gelernt, Anforderungen sorgfältig zu analysieren und daraus klare technische Entscheidungen abzuleiten. Ihr Fokus auf nutzerfreundliche Produkte passt zu den Aufgaben, an denen ich gerne arbeite.

In einem Hochschulprojekt habe ich eine bestehende Anwendung in eine modulare Vue-Architektur überführt. Dabei habe ich Komponenten getrennt, Schnittstellen dokumentiert und die Darstellung von gestreamten Antworten verbessert. In einem weiteren Projekt habe ich React-Komponenten entwickelt und Benachrichtigungen über WebSockets eingebunden. Mit Flutter und Supabase habe ich außerdem eine mobile Anwendung umgesetzt und ihre Datenzugriffe strukturiert. Diese Projekte haben mir gezeigt, wie wichtig verständlicher Code, regelmäßige Tests und ein enger Austausch mit anderen Entwicklern sind. Bei neuen Aufgaben arbeite ich mich systematisch in die vorhandene Architektur ein und bespreche mögliche Lösungen frühzeitig mit dem Team.

Neben meinen technischen Kenntnissen bringe ich Erfahrung in der Zusammenarbeit mit internationalen Teams mit. Ich kommuniziere sicher auf Deutsch und Englisch und übernehme gerne Verantwortung für konkrete Aufgaben. Mein Pflichtpraktikum umfasst zwanzig Wochen; den genauen Beginn kann ich gemeinsam mit Ihnen abstimmen. Gerne erläutere ich Ihnen in einem persönlichen Gespräch, wie ich Ihre Projekte unterstützen kann, und zeige Ihnen Beispiele meiner bisherigen Arbeit. Ich freue mich über Ihre Rückmeldung.

Mit freundlichen Grüßen
Erika Müller`;

test("German letter roles preserve header, date, subject and sign-off", () => {
  const blocks = parseDraft(germanDraft.replace(/\n/g, "\r\n"), "anschreiben");
  assert.deepEqual(blocks.map(b => b.kind), ["sender", "recipient", "date", "subject", "body", "body", "body", "body", "closing"]);
  assert.equal(blocks.at(-1)?.text, "Mit freundlichen Grüßen\nErika Müller");
});

test("body-only draft is never mistaken for sender information", () => {
  assert.ok(parseDraft("My opening paragraph.\n\nMy closing paragraph.", "anschreiben").every(b => b.kind === "body"));
});

test("date placeholders and English subjects work", () => {
  const blocks = parseDraft("Jane Smith\nMain Street\n\nExample Ltd\n\n[Date]\n\nApplication for Software Engineer\n\nDear Hiring Team,\n\nI build software.", "anschreiben");
  assert.deepEqual(blocks.slice(0, 5).map(b => b.kind), ["sender", "recipient", "date", "subject", "body"]);
});

test("email keeps content left aligned, with only the subject bold", async () => {
  const { layout } = await prepareLetter("Subject: A quick introduction\n\nHi Erika,\n\nCould we arrange a call?\n\nJane", "email", fonts);
  assert.equal(layout.blocks[0].kind, "subject");
  assert.ok(layout.blocks.slice(1).every(b => b.kind === "body"));
});

test("both downloads share one readable A4 layout and retain all text", async () => {
  const prepared = await prepareLetter(germanDraft, "anschreiben", fonts);
  const { layout } = prepared;
  assert.ok(layout.fontSize >= 10);
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  assert.equal(normalize(layout.blocks.flatMap(b => b.lines.map(l => l.text)).join(" ")), normalize(germanDraft));
  const pdf = await PDFDocument.load(await makePdf(prepared));
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getPage(0).getWidth(), PAGE.width);
  const zip = await JSZip.loadAsync(await makeWord(layout, "de"));
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.ok(xml.includes('w:jc w:val="right"'));
  assert.ok(xml.includes('w:lineRule="exact"'));
  assert.ok(xml.includes("Schillerstraße"));
  assert.ok(xml.includes("Grüßen"));
  assert.ok(xml.includes('w:b'));
  assert.ok(!xml.includes('w:type="page"'));
});

test("long text tightens layout before rejecting content that cannot fit", async () => {
  const normal = await prepareLetter(germanDraft, "anschreiben", fonts);
  const longer = await prepareLetter(germanDraft + "\n\n" + "Additional relevant experience. ".repeat(35), "anschreiben", fonts);
  assert.ok(longer.layout.fontSize < normal.layout.fontSize || longer.layout.lineHeight < normal.layout.lineHeight);
  await assert.rejects(() => prepareLetter(germanDraft.repeat(8), "anschreiben", fonts), (e: unknown) => e instanceof ExportError && e.code === "overflow");
});

test("very long URLs wrap inside the page", async () => {
  const { regular, layout } = await prepareLetter("https://example.com/" + "a".repeat(260), "email", fonts);
  assert.ok(layout.blocks[0].lines.length > 1);
  for (const line of layout.blocks[0].lines) assert.ok(regular.widthOfTextAtSize(line.text, layout.fontSize) <= PAGE.width - PAGE.left - PAGE.right);
  assert.equal(layout.blocks[0].lines.map(l => l.text).join(""), "https://example.com/" + "a".repeat(260));
});

test("empty drafts and unsupported glyphs fail explicitly", async () => {
  await assert.rejects(() => prepareLetter(" \n ", "email", fonts), (e: unknown) => e instanceof ExportError && e.code === "empty");
  await assert.rejects(() => prepareLetter("Hello 👋", "email", fonts), (e: unknown) => e instanceof ExportError && e.code === "characters");
});

test("filename is safe on Windows and reflects the edited subject", async () => {
  const { layout } = await prepareLetter("Subject: Senior Developer / R&D?\n\nEdited draft", "email", fonts);
  assert.equal(exportFilename(layout, "email", "en"), "Subject Senior Developer R&D");
});

test("cover-letter filenames identify the company and applicant", async () => {
  const { layout } = await prepareLetter(germanDraft, "anschreiben", fonts);
  assert.equal(exportFilename(layout, "anschreiben", "de"), "Anschreiben_Beispiel_GmbH_Erika_Müller");
  assert.equal(exportFilename(layout, "anschreiben", "en"), "Anschreiben_Beispiel_GmbH_Erika_Müller");
  const fallback = await prepareLetter("Bewerbung als Entwickler\n\nSehr geehrte Damen und Herren,\n\nMein Text.\n\nMit freundlichen Grüßen\nErika Müller", "anschreiben", fonts);
  assert.equal(exportFilename(fallback.layout, "anschreiben", "de"), "Anschreiben_Erika_Müller");
});

test("missing details and unsafe filename characters are handled cleanly", async () => {
  const { layout } = await prepareLetter("[Name]\n[Adresse]\n\n[Company]\n\nBewerbung als Entwickler\n\nSehr geehrte Damen und Herren,\n\nMein Text.", "anschreiben", fonts);
  assert.equal(exportFilename(layout, "anschreiben", "de"), "Anschreiben");
  const named = await prepareLetter(germanDraft.replace("Beispiel GmbH", "Example / R&D: GmbH?"), "anschreiben", fonts);
  assert.equal(exportFilename(named.layout, "anschreiben", "de"), "Anschreiben_Example_R&D_GmbH_Erika_Müller");
});

test("subject and sign-off have a clear gap even when input uses a single newline", async () => {
  const draft = germanDraft.replace("Aachen, 04.10.2026\n\n", "").replace("50678 Köln\n\n", "50678 Köln\n").replace("Rückmeldung.\n\n", "Rückmeldung.\n");
  const { layout } = await prepareLetter(draft, "anschreiben", fonts);
  const subject = layout.blocks.findIndex(block => block.kind === "subject");
  const closing = layout.blocks.findIndex(block => block.kind === "closing");
  assert.ok(layout.blocks[subject - 1].after >= 24);
  assert.ok(layout.blocks[closing - 1].after >= 24);
  const compact = await prepareLetter(draft.replace("Mit freundlichen Grüßen", "Additional relevant experience. ".repeat(25) + "\n\nMit freundlichen Grüßen"), "anschreiben", fonts);
  for (const [index, block] of compact.layout.blocks.entries()) {
    if (block.kind === "subject" || block.kind === "closing") assert.ok(compact.layout.blocks[index - 1].after >= 24);
  }
});
