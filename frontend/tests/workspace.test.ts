import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/app", pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
dom.window.scrollTo = () => {};
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: App } = await import("../src/App");
const { default: SkillCoach } = await import("../src/components/SkillCoach");
const { default: OutputPanel } = await import("../src/components/OutputPanel");
const { storeRecovery, readRecovery, hasRecovery } = await import("../src/lib/draftSaver");
const { act, createElement } = React;
const container = document.getElementById("root")!;

function button(label: string) {
  const value = Array.from(container.querySelectorAll("button")).find(element => element.textContent?.trim() === label);
  assert.ok(value, `Button ${label} exists`); return value;
}
async function click(element: Element) { await act(async () => { element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); }
function pendingResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; }); return { promise, resolve };
}
const analysis = { match_score: 70, score_rationale: "Strong Python fit", matching_skills: [{ skill: "Python", evidence: "Built FastAPI services" }], skill_gaps: ["Kubernetes"], generated_draft: "Subject: Example role\n\nDear Hiring Team,\n\nI build Python services.\n\nBest,\nAlex", usage: { used_today: 1, daily_limit: 5 } };
const plan = { summary: "Learn Kubernetes", items: [{ gap: "Kubernetes", guidance: "Build a small cluster", source_slugs: ["kubernetes"] }], sources: [], grounded: true };

test("recovery survives reload, stays account-scoped, and tolerates damaged storage", () => {
  storeRecovery("user-one", { id: "analysis-one", text: "unsent edit", document: null }, false);
  assert.equal(hasRecovery("user-one"), true);
  assert.equal(readRecovery("user-one", "analysis-one")?.text, "unsent edit");
  assert.equal(readRecovery("user-two", "analysis-one"), null);
  localStorage.setItem("align_draft_recovery:user-one:analysis-one", "invalid JSON");
  assert.equal(readRecovery("user-one", "analysis-one"), null);
  storeRecovery("user-one", { id: "analysis-one", text: "unsent edit", document: null }, true);
  assert.equal(hasRecovery("user-one"), false);
});

test("example inputs enable generation, expose privacy copy, and retain original output locale", async t => {
  const originalFetch = globalThis.fetch; const response = pendingResponse(); let payload: Record<string, string> = {};
  globalThis.fetch = async (_url, options) => { payload = JSON.parse(String(options?.body)); return response.promise; };
  const root = createRoot(container); t.after(async () => { await act(async () => root.unmount()); globalThis.fetch = originalFetch; });
  await act(async () => root.render(createElement(App)));
  assert.equal(container.querySelectorAll('[aria-label="Interface language"]').length, 0);
  assert.match(container.textContent!, /Google Gemini/);
  await click(button("Try with example inputs"));
  assert.match((container.querySelector('[aria-label="Resume"]') as HTMLTextAreaElement).value, /Alex Morgan/);
  await click(button("Email"));
  const generate = Array.from(container.querySelectorAll("button")).find(value => value.textContent?.includes("Write outreach email"))!;
  assert.equal((generate as HTMLButtonElement).disabled, false); await click(generate);
  await click(button("Deutsch"));
  await act(async () => response.resolve(new Response(JSON.stringify(analysis), { status: 200 })));
  assert.equal(payload.language, "en"); assert.equal(payload.mode, "email");
  assert.match(container.textContent!, /Eingaben geändert/);
  assert.match(container.textContent!, /E-Mail · English/);
  assert.match(container.textContent!, /Strong Python fit/);
});

test("cancelled analysis cannot overwrite the existing result even if its response arrives", async t => {
  const originalFetch = globalThis.fetch; const late = pendingResponse(); let requests = 0;
  globalThis.fetch = async () => ++requests === 1 ? new Response(JSON.stringify(analysis)) : late.promise;
  const root = createRoot(container); t.after(async () => { await act(async () => root.unmount()); globalThis.fetch = originalFetch; });
  await act(async () => root.render(createElement(App)));
  await click(button("Try with example inputs"));
  const generate = () => Array.from(container.querySelectorAll("button")).find(value => value.textContent?.includes("Generate cover letter"))!;
  await click(generate()); assert.match(container.textContent!, /Strong Python fit/);
  await click(generate()); await click(button("Cancel · keep previous draft"));
  await act(async () => late.resolve(new Response(JSON.stringify({ ...analysis, score_rationale: "STALE RESPONSE" }))));
  assert.match(container.textContent!, /Strong Python fit/); assert.doesNotMatch(container.textContent!, /STALE RESPONSE/);
});

test("coach sends auth and original context, and ignores responses after context changes", async t => {
  const originalFetch = globalThis.fetch; const late = pendingResponse(); let sent: RequestInit | undefined;
  globalThis.fetch = async (_url, options) => { sent = options; return late.promise; };
  const root = createRoot(container); t.after(async () => { await act(async () => root.unmount()); globalThis.fetch = originalFetch; });
  const props = { gaps: ["Kubernetes"], language: "en" as const, resumeText: "original resume", jobDescriptionText: "original job", analysisKey: "first", accessToken: "user-token" };
  await act(async () => root.render(createElement(SkillCoach, props)));
  await click(button("Generate learning plan"));
  assert.equal((sent?.headers as Record<string, string>).Authorization, "Bearer user-token");
  assert.equal(JSON.parse(String(sent?.body)).resume_text, "original resume");
  await act(async () => root.render(createElement(SkillCoach, { ...props, resumeText: "new resume", language: "de", analysisKey: "second" })));
  assert.equal(sent?.signal?.aborted, true);
  await act(async () => late.resolve(new Response(JSON.stringify(plan))));
  assert.doesNotMatch(container.textContent!, /Build a small cluster/);
  assert.match(container.textContent!, /Lernplan erstellen/);
});

test("coach rate-limit errors retain a clear retry path", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "Daily learning plan limit reached. Resets at midnight UTC." }), { status: 429 });
  const root = createRoot(container); t.after(async () => { await act(async () => root.unmount()); globalThis.fetch = originalFetch; });
  await act(async () => root.render(createElement(SkillCoach, { gaps: ["Kubernetes"], language: "en", resumeText: "resume", jobDescriptionText: "job", analysisKey: "run" })));
  await click(button("Generate learning plan"));
  assert.match(container.textContent!, /Resets at midnight UTC/);
  assert.equal(button("Generate learning plan").disabled, false);
});

test("perfect and unrelated analyses explain empty skill lists without inventing entries", async t => {
  const root = createRoot(container); t.after(async () => { await act(async () => root.unmount()); });
  await act(async () => root.render(createElement(OutputPanel, {
    language: "en", resultLanguage: "en", mode: "email", result: { ...analysis, matching_skills: [], skill_gaps: [] }, draft: analysis.generated_draft, draftDocument: null, draftSaveError: false, saveStatus: "idle", canSave: false, onRetrySave() {}, isStale: false, analysisKey: "run", onDraftChange() {}, activeTab: "analysis", onTabChange() {}, isLoading: false, resumeText: "resume", jobDescriptionText: "job",
  })));
  assert.match(container.textContent!, /No evidenced matches found/);
  assert.match(container.textContent!, /No significant skill gaps identified/);
  assert.doesNotMatch(container.textContent!, /Generate learning plan/);
});
