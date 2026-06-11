import { useState } from "react";
import Header from "./components/Header";
import InputPanel from "./components/InputPanel";
import OutputPanel from "./components/OutputPanel";

export type Mode = "anschreiben" | "email";
export type Language = "en" | "de";
export type OutputTab = "analysis" | "draft";

export interface AnalysisResult {
  matching_skills: string[];
  skill_gaps: string[];
  generated_draft: string;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("anschreiben");
  const [language, setLanguage] = useState<Language>("en");

  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState<OutputTab>("analysis");

  const handleAnalyze = async () => {
    if (isLoading || !resumeText.trim() || !jobDescriptionText.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description_text: jobDescriptionText,
          mode,
          language,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error — please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-white">
      <Header mode={mode} onModeChange={setMode} language={language} onLanguageChange={setLanguage} />

      <main className="grid grid-cols-2 h-[calc(100vh-64px)] overflow-hidden">
        <InputPanel
          language={language}
          resumeText={resumeText}
          onResumeChange={setResumeText}
          jobDescriptionText={jobDescriptionText}
          onJobDescriptionChange={setJobDescriptionText}
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          error={error}
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
    </div>
  );
}
