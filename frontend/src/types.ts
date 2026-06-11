// Shared app-wide types (kept out of App.tsx so components and lib code
// can import them without circular references).

export type Mode = "anschreiben" | "email";
export type Language = "en" | "de";
export type OutputTab = "analysis" | "draft";
export type View = "workspace" | "history" | "vault" | "jobs" | "insights";

export interface UsageInfo {
  used_today: number;
  daily_limit: number;
}

/** Response of POST /api/analyze. */
export interface AnalysisResult {
  matching_skills: string[];
  skill_gaps: string[];
  generated_draft: string;
  analysis_id?: string | null;
  usage?: UsageInfo | null;
  prompt_tokens?: number | null;
  output_tokens?: number | null;
}

// ---- Database rows (match supabase/schema.sql) ----

export interface ResumeRow {
  id: string;
  title: string;
  content: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface AnalysisRow {
  id: string;
  resume_id: string | null;
  job_description_id: string | null;
  resume_snapshot: string;
  job_description_snapshot: string;
  mode: Mode;
  language: Language;
  matching_skills: string[];
  skill_gaps: string[];
  generated_draft: string;
  final_draft: string | null;
  prompt_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface UsageRow {
  prompt_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}
