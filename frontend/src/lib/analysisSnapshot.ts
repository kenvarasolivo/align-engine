import type { Language, Mode, WritingStyle } from "../types";

export interface AnalysisSnapshot {
  resume: string;
  job: string;
  mode: Mode;
  language: Language;
  motivation: string;
  style: WritingStyle;
}
export function snapshotKey(value: AnalysisSnapshot): string {
  return JSON.stringify([value.resume, value.job, value.mode, value.language, value.motivation.trim(), value.style]);
}
