import type { Mode } from "../types";
import type { LetterBlock, BlockKind } from "./letterLayout";

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

