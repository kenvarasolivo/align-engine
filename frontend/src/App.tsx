import { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import InputPanel from "./components/InputPanel";
import OutputPanel from "./components/OutputPanel";
import LoginPage from "./components/LoginPage";
import HistoryPage from "./components/HistoryPage";
import VaultPage from "./components/VaultPage";
import JobsPage from "./components/JobsPage";
import InsightsPage from "./components/InsightsPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import * as db from "./lib/db";
import type {
  AnalysisResult,
  AnalysisRow,
  JobRow,
  Language,
  Mode,
  OutputTab,
  ResumeRow,
  UsageInfo,
  View,
} from "./types";

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function deriveTitle(text: string, fallback: string): string {
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  if (!firstLine) return fallback;
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}

function AppShell() {
  const { authEnabled, initializing, session, user, isGuest, exitGuest, signOut } = useAuth();

  const [view, setView] = useState<View>("workspace");
  const [mode, setMode] = useState<Mode>("anschreiben");
  const [language, setLanguage] = useState<Language>("en");

  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");

  // Provenance: vault ids when the current texts came from saved items.
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState<OutputTab>("analysis");
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  const resumeTextRef = useRef(resumeText);
  resumeTextRef.current = resumeText;

  // Resume vault auto-load: when a user signs in with an empty workspace,
  // bring back their last-used resume so they never re-paste it.
  useEffect(() => {
    if (!session) return;
    if (resumeTextRef.current.trim()) return;
    let cancelled = false;
    db.latestResume()
      .then((row) => {
        if (cancelled || !row || resumeTextRef.current.trim()) return;
        setResumeText(row.content);
        setActiveResumeId(row.id);
      })
      .catch(() => {
        /* vault unavailable — start blank */
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave the edited draft into the analysis history row.
  useEffect(() => {
    if (!session || !result?.analysis_id) return;
    if (draft === result.generated_draft) return;
    const analysisId = result.analysis_id;
    const timer = setTimeout(() => {
      db.updateFinalDraft(analysisId, draft).catch(() => {
        /* non-critical — the draft still lives in the editor */
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [draft, session, result]);

  const handleAnalyze = async () => {
    if (isLoading || !resumeText.trim() || !jobDescriptionText.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({
          resume_text: resumeText,
          job_description_text: jobDescriptionText,
          mode,
          language,
          resume_id: activeResumeId,
          job_description_id: activeJobId,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
      setDraft(data.generated_draft);
      setActiveTab("analysis");
      if (data.usage) setUsage(data.usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error — please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveResume = async (): Promise<boolean> => {
    if (!user || !resumeText.trim()) return false;
    try {
      const row = await db.saveResume(
        user.id,
        deriveTitle(resumeText, `Resume — ${new Date().toLocaleDateString()}`),
        resumeText
      );
      setActiveResumeId(row.id);
      return true;
    } catch {
      return false;
    }
  };

  const handleSaveJob = async (): Promise<boolean> => {
    if (!user || !jobDescriptionText.trim()) return false;
    try {
      const row = await db.saveJob(
        user.id,
        deriveTitle(jobDescriptionText, `Job — ${new Date().toLocaleDateString()}`),
        jobDescriptionText
      );
      setActiveJobId(row.id);
      return true;
    } catch {
      return false;
    }
  };

  const loadResume = (row: ResumeRow) => {
    setResumeText(row.content);
    setActiveResumeId(row.id);
    db.touchResume(row.id).catch(() => {});
    setView("workspace");
  };

  const loadJob = (row: JobRow) => {
    setJobDescriptionText(row.content);
    setActiveJobId(row.id);
    setView("workspace");
  };

  const loadAnalysis = (row: AnalysisRow) => {
    setResumeText(row.resume_snapshot);
    setJobDescriptionText(row.job_description_snapshot);
    setMode(row.mode);
    setLanguage(row.language);
    setActiveResumeId(row.resume_id);
    setActiveJobId(row.job_description_id);
    setResult({
      matching_skills: row.matching_skills,
      skill_gaps: row.skill_gaps,
      generated_draft: row.generated_draft,
      analysis_id: row.id,
    });
    setDraft(row.final_draft ?? row.generated_draft);
    setActiveTab("draft");
    setView("workspace");
  };

  const handleSignOut = async () => {
    await signOut();
    // Leave nothing of the previous user behind on a shared machine.
    setView("workspace");
    setResumeText("");
    setJobDescriptionText("");
    setActiveResumeId(null);
    setActiveJobId(null);
    setResult(null);
    setDraft("");
    setUsage(null);
    setError(null);
    setActiveTab("analysis");
  };

  if (initializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-surface">
        <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-xl bg-cobalt shadow-cta" aria-hidden="true">
          <svg className="h-5 w-5 text-white" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="3" width="12" height="2.5" rx="1.25" />
            <rect x="2" y="6.75" width="9" height="2.5" rx="1.25" opacity="0.75" />
            <rect x="5" y="10.5" width="9" height="2.5" rx="1.25" opacity="0.5" />
          </svg>
        </span>
        <p className="text-sm font-extrabold tracking-[0.2em] text-obsidian select-none">ALIGN</p>
      </div>
    );
  }

  if (authEnabled && !session && !isGuest) {
    return <LoginPage />;
  }

  const isSignedIn = Boolean(session);
  const effectiveView: View = isSignedIn ? view : "workspace";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">
      <Header
        view={effectiveView}
        onViewChange={setView}
        mode={mode}
        onModeChange={setMode}
        language={language}
        onLanguageChange={setLanguage}
        userEmail={session?.user.email ?? null}
        usage={usage}
        onSignOut={handleSignOut}
        onGoToLogin={exitGuest}
      />

      {effectiveView === "workspace" ? (
        <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 p-3 lg:p-4 overflow-y-auto lg:overflow-hidden">
          <InputPanel
            language={language}
            resumeText={resumeText}
            onResumeChange={setResumeText}
            jobDescriptionText={jobDescriptionText}
            onJobDescriptionChange={setJobDescriptionText}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            error={error}
            canSave={isSignedIn}
            onSaveResume={handleSaveResume}
            onSaveJob={handleSaveJob}
            onResumeFileUploaded={() => setActiveResumeId(null)}
          />
          <OutputPanel
            language={language}
            result={result}
            draft={draft}
            onDraftChange={setDraft}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isLoading={isLoading}
          />
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto">
          {effectiveView === "history" && <HistoryPage language={language} onLoadAnalysis={loadAnalysis} />}
          {effectiveView === "vault" && <VaultPage language={language} onUseResume={loadResume} />}
          {effectiveView === "jobs" && <JobsPage language={language} onUseJob={loadJob} />}
          {effectiveView === "insights" && <InsightsPage language={language} />}
        </main>
      )}
    </div>
  );
}
