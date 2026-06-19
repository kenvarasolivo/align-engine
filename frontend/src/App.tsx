import { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import InputPanel from "./components/InputPanel";
import OutputPanel from "./components/OutputPanel";
import LoginPage from "./components/LoginPage";
import type { AuthMode } from "./components/LoginPage";
import LandingPage from "./components/LandingPage";
import HistoryPage from "./components/HistoryPage";
import VaultPage from "./components/VaultPage";
import JobsPage from "./components/JobsPage";
import InsightsPage from "./components/InsightsPage";
import { LogoMark } from "./components/Logo";
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
      <Root />
    </AuthProvider>
  );
}

/**
 * Minimal History-API routing: "/" is the marketing landing page, "/app"
 * (and subpaths) is the dashboard. Unknown paths fall back to the landing
 * page; reloads keep the user wherever they were.
 */
function Root() {
  const { exitGuest } = useAuth();
  const [path, setPath] = useState(() => window.location.pathname);
  // Which tab the LoginPage opens on when entering /app from the landing nav.
  const [authMode, setAuthMode] = useState<AuthMode>("signin");

  const navigate = (to: string) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, "", to);
    }
    setPath(to);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (path.startsWith("/app")) {
    return <AppShell navigate={navigate} initialAuthMode={authMode} />;
  }

  return (
    <LandingPage
      navigate={navigate}
      onOpenAuth={(mode) => {
        setAuthMode(mode);
        // A previous guest session would skip the login page — leave it
        // so Log in / Register actually show the auth form.
        exitGuest();
        navigate("/app");
      }}
    />
  );
}

function deriveTitle(text: string, fallback: string): string {
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  if (!firstLine) return fallback;
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}

interface AppShellProps {
  navigate: (to: string) => void;
  initialAuthMode: AuthMode;
}

function AppShell({ navigate, initialAuthMode }: AppShellProps) {
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
      match_score: row.match_score ?? 0,
      score_rationale: row.score_rationale ?? "",
      // Stored rows keep only skill names; evidence isn't persisted.
      matching_skills: row.matching_skills.map((skill) => ({ skill, evidence: null })),
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
    navigate("/");
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
        <LogoMark className="h-12 w-12 animate-pulse" />
        <p className="text-sm font-extrabold tracking-[0.2em] text-obsidian select-none">ALIGN</p>
      </div>
    );
  }

  if (authEnabled && !session && !isGuest) {
    return <LoginPage initialMode={initialAuthMode} />;
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
        onLogoClick={() => navigate("/")}
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
            resumeText={resumeText}
            jobDescriptionText={jobDescriptionText}
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
