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

/** A matching skill paired with verbatim evidence from the resume. */
export interface SkillMatch {
  skill: string;
  /** Resume quote backing the skill; null for older history rows (not persisted). */
  evidence?: string | null;
}

/** Response of POST /api/analyze. */
export interface AnalysisResult {
  match_score: number;
  score_rationale: string;
  matching_skills: SkillMatch[];
  skill_gaps: string[];
  generated_draft: string;
  analysis_id?: string | null;
  usage?: UsageInfo | null;
  prompt_tokens?: number | null;
  output_tokens?: number | null;
}

// ---- Skill Coach (RAG over pgvector) ----

/** A knowledge-base card retrieved from pgvector to ground the coach. */
export interface RetrievedSkill {
  slug: string;
  name: string;
  category?: string | null;
  summary: string;
  how_to_close: string;
  /** Cosine similarity to the queried gap, 0–1 (higher = closer). */
  similarity: number;
}

/** One grounded recommendation, citing the KB card it draws from. */
export interface SkillPlanItem {
  gap: string;
  guidance: string;
  source_slug: string;
}

/** Response of POST /api/skill-coach. */
export interface SkillCoachResult {
  summary: string;
  items: SkillPlanItem[];
  sources: RetrievedSkill[];
  /** False when retrieval was unavailable and guidance fell back to empty. */
  grounded: boolean;
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
  match_score: number | null;
  score_rationale: string | null;
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
