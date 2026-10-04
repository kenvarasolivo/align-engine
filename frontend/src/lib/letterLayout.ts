export type BlockKind = "sender" | "recipient" | "date" | "subject" | "body" | "closing";
export interface LetterBlock { text: string; kind: BlockKind }
export interface LayoutLine { text: string; bold: boolean }
export interface LayoutBlock extends LetterBlock { lines: LayoutLine[]; after: number }
export interface LetterLayout { blocks: LayoutBlock[]; fontSize: number; lineHeight: number; height: number }
export class ExportError extends Error {
  constructor(public code: "empty" | "overflow" | "characters" | "fonts") { super(code); }
}
export const PAGE = { width: 595.28, height: 841.89, top: 56.7, bottom: 56.7, left: 62.4, right: 62.4 };
