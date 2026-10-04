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
import { DraftSaver, hasRecovery, readRecovery, storeRecovery, type SaveStatus } from "./lib/draftSaver";
import { snapshotKey, type AnalysisSnapshot } from "./lib/analysisSnapshot";
import type {
  AnalysisResult,
  AnalysisRow,
  DraftDocument,
  JobRow,
  Language,
  Mode,
  OutputTab,
  ResumeRow,
  UsageInfo,
  View,
  WritingStyle,
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
  const [personalMotivation, setPersonalMotivation] = useState("");
  const [writingStyle, setWritingStyle] = useState<WritingStyle>("neutral");

  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [resumeTitle, setResumeTitle] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  // Provenance: vault ids when the current texts came from saved items.
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState("");
  const [draftDocument, setDraftDocument] = useState<DraftDocument | null>(null);
  const [draftSaveError, setDraftSaveError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [resultSnapshot, setResultSnapshot] = useState<AnalysisSnapshot | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [resultGeneration, setResultGeneration] = useState(0);
  const saver = useRef<DraftSaver | null>(null);
  const analysisRequest = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
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
        setResumeTitle(row.title);
        setActiveResumeId(row.id);
      })
      .catch(() => {
        /* vault unavailable — start blank */
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Serialize writes and keep unsent signed-in edits recoverable on this device.
  useEffect(() => {
    if (!user) { saver.current = null; return; }
    const userId = user.id;
    setRecoveryAvailable(hasRecovery(userId));
    const writer = new DraftSaver(
      edit => db.updateFinalDraft(edit.id, edit.text, edit.document),
      status => { setSaveStatus(status); setDraftSaveError(status === "error"); },
      (edit, saved) => { storeRecovery(userId, edit, saved); setRecoveryAvailable(hasRecovery(userId)); },
    );
    saver.current = writer;
    const unload = (event: BeforeUnloadEvent) => {
      if (writer.dirty) { event.preventDefault(); event.returnValue = ""; }
    };
    const hidden = () => { if (document.visibilityState === "hidden") void writer.flush().catch(() => {}); };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", hidden);
      void writer.flush().catch(() => {});
      writer.dispose();
    };
  }, [user?.id]);

  useEffect(() => () => { analysisRequest.current?.abort(); requestVersion.current += 1; }, []);
  const guestHasEdits = !user && Boolean(draft.trim()) && (draft !== (result?.generated_draft ?? "") || draftDocument !== null);
  useEffect(() => {
    if (!guestHasEdits) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [guestHasEdits]);
  const canReplaceGuestDraft = () => !guestHasEdits || window.confirm(language === "de" ? "Ihr bearbeiteter Gastentwurf wird ersetzt. Exportieren Sie ihn zuerst, wenn Sie ihn behalten möchten. Fortfahren?" : "Your edited guest draft will be replaced. Export it first if you want to keep it. Continue?");
  const flushDraft = async () => {
    try { await saver.current?.flush(); return true; }
    catch { setDraftSaveError(true); setError(language === "de" ? "Der Entwurf konnte nicht gespeichert werden. Bitte erneut speichern oder vor dem Verlassen exportieren." : "Your draft could not be saved. Retry saving or export it before leaving."); return false; }
  };
  const prepareToLeave = async () => {
    if (await flushDraft()) return true;
    const hasLocalCopy = Boolean(user && result?.analysis_id && readRecovery(user.id, result.analysis_id));
    const message = hasLocalCopy
      ? (language === "de" ? "Änderungen konnten nicht synchronisiert werden. Eine Wiederherstellungskopie bleibt auf diesem Gerät und kann über den Verlauf geöffnet werden. Trotzdem fortfahren?" : "Changes could not sync. A recovery copy will remain on this device and can be reopened from History. Continue anyway?")
      : (language === "de" ? "Änderungen konnten nicht gespeichert werden. Exportieren Sie den Entwurf zuerst, um ihn zu behalten. Trotzdem fortfahren und ungespeicherte Änderungen verwerfen?" : "Changes could not be saved. Export the draft first to keep it. Continue anyway and discard unsaved changes?");
    if (!window.confirm(message)) return false;
    saver.current?.deferRecovery();
    return true;
  };
  const currentSnapshot: AnalysisSnapshot = { resume: resumeText, job: jobDescriptionText, mode, language, motivation: personalMotivation, style: writingStyle };
  const resultIsStale = Boolean(resultSnapshot && snapshotKey(resultSnapshot) !== snapshotKey(currentSnapshot));
  const cancelAnalysis = () => {
    requestVersion.current += 1;
    analysisRequest.current?.abort();
    analysisRequest.current = null;
    setIsLoading(false);
  };

  const handleAnalyze = async () => {
    if (isLoading || !resumeText.trim() || !jobDescriptionText.trim()) return;
    if (!canReplaceGuestDraft()) return;

    setIsLoading(true);
    setError(null);
    const version = ++requestVersion.current;
    const controller = new AbortController();
    analysisRequest.current = controller;
    const snapshot = { ...currentSnapshot };

    try {
      if (!await flushDraft() || version !== requestVersion.current) return;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          resume_text: resumeText,
          job_description_text: jobDescriptionText,
          mode,
          language,
          personal_motivation: personalMotivation.trim() || null,
          writing_style: writingStyle,
          // History title defaults to the job title; fall back to the job's first line.
          title: jobTitle.trim() || deriveTitle(jobDescriptionText, ""),
          resume_id: activeResumeId,
          job_description_id: activeJobId,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
      }

      const data: AnalysisResult = await response.json();
      if (version !== requestVersion.current) return;
      setResult(data);
      setResultGeneration(version);
      setSaveStatus("idle");
      setResultSnapshot(snapshot);
      setDraft(data.generated_draft);
      setDraftDocument(null);
      setDraftSaveError(false);
      setActiveTab("analysis");
      if (data.usage) setUsage(data.usage);
    } catch (err) {
      if (version !== requestVersion.current || controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Unexpected error — please try again.");
    } finally {
      if (version === requestVersion.current) { setIsLoading(false); analysisRequest.current = null; }
    }
  };

  const handleSaveResume = async (): Promise<boolean> => {
    if (!user || !resumeText.trim()) return false;
    try {
      const row = await db.saveResume(
        user.id,
        resumeTitle.trim() || deriveTitle(resumeText, `Resume — ${new Date().toLocaleDateString()}`),
        resumeText
      );
      setActiveResumeId(row.id);
      setResumeTitle(row.title);
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
        jobTitle.trim() || deriveTitle(jobDescriptionText, `Job — ${new Date().toLocaleDateString()}`),
        jobDescriptionText
      );
      setActiveJobId(row.id);
      setJobTitle(row.title);
      return true;
    } catch {
      return false;
    }
  };

  const loadResume = (row: ResumeRow) => {
    setResumeText(row.content);
    setResumeTitle(row.title);
    setActiveResumeId(row.id);
    db.touchResume(row.id).catch(() => {});
    setView("workspace");
  };

  const loadJob = (row: JobRow) => {
    setJobDescriptionText(row.content);
    setJobTitle(row.title);
    setActiveJobId(row.id);
    setView("workspace");
  };

  const loadAnalysis = async (row: AnalysisRow) => {
    if (!await prepareToLeave()) return;
    cancelAnalysis();
    setResultGeneration(value => value + 1);
    setResumeText(row.resume_snapshot);
    setJobDescriptionText(row.job_description_snapshot);
    // The analysis only stores the (job-derived) history title; the resume
    // title isn't persisted, so clear it rather than show a stale one.
    setResumeTitle("");
    setJobTitle(row.title ?? "");
    setMode(row.mode);
    setLanguage(row.language);
    setPersonalMotivation(row.personal_motivation ?? "");
    setWritingStyle(row.writing_style ?? "neutral");
    setResultSnapshot({ resume: row.resume_snapshot, job: row.job_description_snapshot, mode: row.mode, language: row.language, motivation: row.personal_motivation ?? "", style: row.writing_style ?? "neutral" });
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
    const recovery = user ? readRecovery(user.id, row.id) : null;
    setDraft(recovery?.text ?? row.final_draft ?? row.generated_draft);
    setDraftDocument(recovery ? recovery.document : row.draft_document ?? null);
    if (recovery) saver.current?.schedule(recovery);
    else setSaveStatus("idle");
    setDraftSaveError(false);
    setActiveTab("draft");
    setView("workspace");
    setError(null);
  };

  const handleSignOut = async () => {
    if (!await prepareToLeave()) return;
    cancelAnalysis();
    await signOut();
    navigate("/");
    // Leave nothing of the previous user behind on a shared machine.
    setPersonalMotivation("");
    setWritingStyle("neutral");
    setView("workspace");
    setResumeText("");
    setJobDescriptionText("");
    setResumeTitle("");
    setJobTitle("");
    setActiveResumeId(null);
    setActiveJobId(null);
    setResult(null);
    setResultSnapshot(null);
    setDraft("");
    setDraftDocument(null);
    setDraftSaveError(false);
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
        onViewChange={async next => { if (next === view || await flushDraft()) setView(next); }}
        language={language}
        userEmail={session?.user.email ?? null}
        usage={usage}
        onSignOut={handleSignOut}
        onGoToLogin={exitGuest}
        onLogoClick={async () => { if (canReplaceGuestDraft() && await prepareToLeave()) { cancelAnalysis(); navigate("/"); } }}
      />

      {draftSaveError && (effectiveView !== "workspace" || activeTab !== "draft") && <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-danger-border bg-danger-soft px-4 py-2 text-sm text-danger-strong">
        <span>{language === "de" ? "Entwurfsänderungen sind noch nicht gespeichert." : "Draft changes have not been saved yet."}</span>
        <button type="button" onClick={() => void flushDraft()} className="focus-ring rounded underline">{language === "de" ? "Erneut speichern" : "Retry save"}</button>
        <button type="button" onClick={() => { setView("workspace"); setActiveTab("draft"); }} className="focus-ring rounded underline">{language === "de" ? "Entwurf öffnen / exportieren" : "Open / export draft"}</button>
      </div>}

      {recoveryAvailable && !result && <p role="status" className="bg-cobalt-50 px-4 py-2 text-sm text-charcoal">{language === "de" ? "Ungespeicherte Änderungen sind auf diesem Gerät verfügbar. Öffnen Sie den zugehörigen Entwurf im Verlauf, um sie wiederherzustellen." : "Unsent edits are available on this device. Open their draft in History to recover them."}</p>}

      {effectiveView === "workspace" ? (
        <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 p-3 lg:p-4 overflow-y-auto lg:overflow-hidden">
          <InputPanel
            language={language}
            onLanguageChange={setLanguage}
            mode={mode}
            onModeChange={setMode}
            personalMotivation={personalMotivation}
            onPersonalMotivationChange={setPersonalMotivation}
            writingStyle={writingStyle}
            onWritingStyleChange={setWritingStyle}
            resumeText={resumeText}
            onResumeChange={text => { setResumeText(text); setActiveResumeId(null); }}
            resumeTitle={resumeTitle}
            onResumeTitleChange={setResumeTitle}
            jobDescriptionText={jobDescriptionText}
            onJobDescriptionChange={text => { setJobDescriptionText(text); setActiveJobId(null); }}
            jobTitle={jobTitle}
            onJobTitleChange={setJobTitle}
            onAnalyze={handleAnalyze}
            onCancel={cancelAnalysis}
            onUseExample={() => {
              setResumeText("Alex Morgan\nalex@example.com\n\nBackend engineer with 4 years of Python experience. Built FastAPI services and REST APIs, designed PostgreSQL schemas, and shipped Docker containers. Set up CI pipelines with GitHub Actions.");
              setJobDescriptionText("ExampleCo — Backend Engineer\n\nWe are looking for a backend engineer with Python, REST API, PostgreSQL and Docker experience. You will build reliable services with our platform team. Kubernetes and Terraform are a plus.");
              setResumeTitle("Example resume"); setJobTitle("ExampleCo — Backend Engineer"); setActiveResumeId(null); setActiveJobId(null);
            }}
            isLoading={isLoading}
            error={error}
            canSave={isSignedIn}
            onSaveResume={handleSaveResume}
            onSaveJob={handleSaveJob}
            onResumeFileUploaded={() => setActiveResumeId(null)}
            onUseResume={loadResume}
            onUseJob={loadJob}
          />
          <OutputPanel
            language={language}
            mode={resultSnapshot?.mode ?? mode}
            result={result}
            draft={draft}
            draftDocument={draftDocument}
            onDraftChange={(text, document) => {
              setDraft(text); setDraftDocument(document);
              if (user && result?.analysis_id) saver.current?.schedule({ id: result.analysis_id, text, document });
            }}
            draftSaveError={draftSaveError}
            saveStatus={saveStatus}
            canSave={Boolean(user && result?.analysis_id)}
            onRetrySave={() => void flushDraft()}
            isStale={resultIsStale}
            resultLanguage={resultSnapshot?.language ?? language}
            analysisKey={`${result?.analysis_id ?? "guest"}:${resultGeneration}`}
            accessToken={session?.access_token}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isLoading={isLoading}
            resumeText={resultSnapshot?.resume ?? resumeText}
            jobDescriptionText={resultSnapshot?.job ?? jobDescriptionText}
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
