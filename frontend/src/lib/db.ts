// Data-access helpers for the user's saved content. All reads/writes run
// under Supabase RLS with the signed-in user's JWT, so each user only ever
// sees their own rows. Functions throw on failure; callers surface the error.

import { supabase } from "./supabase";
import type { AnalysisRow, JobRow, ResumeRow, UsageRow } from "../types";

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

// ---- Resume vault ----

export async function listResumes(): Promise<ResumeRow[]> {
  const { data, error } = await client()
    .from("resumes")
    .select("*")
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as ResumeRow[];
}

export async function latestResume(): Promise<ResumeRow | null> {
  const rows = await listResumes();
  return rows[0] ?? null;
}

export async function saveResume(userId: string, title: string, content: string): Promise<ResumeRow> {
  const { data, error } = await client()
    .from("resumes")
    .insert({ user_id: userId, title, content, last_used_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as ResumeRow;
}

export async function renameResume(id: string, title: string): Promise<void> {
  const { error } = await client()
    .from("resumes")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteResume(id: string): Promise<void> {
  const { error } = await client().from("resumes").delete().eq("id", id);
  if (error) throw error;
}

export async function touchResume(id: string): Promise<void> {
  const { error } = await client()
    .from("resumes")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---- Saved job descriptions ----

export async function listJobs(): Promise<JobRow[]> {
  const { data, error } = await client()
    .from("job_descriptions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as JobRow[];
}

export async function saveJob(userId: string, title: string, content: string): Promise<JobRow> {
  const { data, error } = await client()
    .from("job_descriptions")
    .insert({ user_id: userId, title, content })
    .select()
    .single();
  if (error) throw error;
  return data as JobRow;
}

export async function renameJob(id: string, title: string): Promise<void> {
  const { error } = await client().from("job_descriptions").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await client().from("job_descriptions").delete().eq("id", id);
  if (error) throw error;
}

// ---- Analysis history ----

export async function listAnalyses(): Promise<AnalysisRow[]> {
  const { data, error } = await client()
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as AnalysisRow[];
}

export async function deleteAnalysis(id: string): Promise<void> {
  const { error } = await client().from("analyses").delete().eq("id", id);
  if (error) throw error;
}

export async function updateFinalDraft(id: string, finalDraft: string): Promise<void> {
  const { error } = await client().from("analyses").update({ final_draft: finalDraft }).eq("id", id);
  if (error) throw error;
}

export async function renameAnalysis(id: string, title: string): Promise<void> {
  const { error } = await client().from("analyses").update({ title }).eq("id", id);
  if (error) throw error;
}

// ---- Usage log (read-only for users; written by the backend) ----

export async function listUsage(): Promise<UsageRow[]> {
  const { data, error } = await client()
    .from("usage_log")
    .select("prompt_tokens,output_tokens,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data as UsageRow[];
}
