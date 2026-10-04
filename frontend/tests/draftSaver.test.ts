import test from "node:test";
import assert from "node:assert/strict";
import { DraftSaver, type DraftEdit } from "../src/lib/draftSaver";
import { snapshotKey } from "../src/lib/analysisSnapshot";

const edit = (text: string, id = "a"): DraftEdit => ({ id, text, document: null });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

test("flush before navigation saves the latest edit without waiting for debounce", async () => {
  const writes: string[] = []; const saved: string[] = [];
  const saver = new DraftSaver(async draft => { writes.push(draft.text); }, () => {}, (draft, done) => { if (done) saved.push(draft.text); });
  saver.schedule(edit("first")); saver.schedule(edit("latest")); await saver.flush();
  assert.deepEqual(writes, ["latest"]); assert.deepEqual(saved, ["latest"]);
  assert.equal(saver.dirty, false); assert.equal(saver.status, "saved"); saver.dispose();
});

test("edits during an in-flight save are written afterward, never concurrently", async () => {
  const first = deferred(); const writes: string[] = []; let active = 0; let maxActive = 0;
  const saver = new DraftSaver(async draft => {
    active++; maxActive = Math.max(maxActive, active); writes.push(draft.text);
    if (draft.text === "first") await first.promise;
    active--;
  }, () => {}, () => {});
  saver.schedule(edit("first")); const flush = saver.flush();
  saver.schedule(edit("second")); saver.schedule(edit("latest"));
  assert.equal(saver.flush(), flush); first.resolve(); await flush;
  assert.deepEqual(writes, ["first", "latest"]); assert.equal(maxActive, 1);
  assert.equal(saver.status, "saved"); saver.dispose();
});

test("failed saves stay recoverable and a retry saves them", async () => {
  let fail = true; const recovered: [string, boolean][] = [];
  const saver = new DraftSaver(async () => { if (fail) throw new Error("offline"); }, () => {}, (draft, saved) => recovered.push([draft.text, saved]));
  saver.schedule(edit("keep me")); await assert.rejects(saver.flush(), /offline/);
  assert.equal(saver.dirty, true); assert.equal(saver.status, "error");
  assert.deepEqual(recovered, [["keep me", false]]);
  fail = false; await saver.flush(); assert.deepEqual(recovered, [["keep me", false], ["keep me", true]]); saver.dispose();
});

test("switching analyses keeps the correct text attached to each row", async () => {
  const writes: DraftEdit[] = [];
  const saver = new DraftSaver(async draft => { writes.push(draft); }, () => {}, () => {});
  saver.schedule(edit("first draft", "a")); saver.schedule(edit("second draft", "b")); await saver.flush();
  assert.deepEqual(writes.map(value => [value.id, value.text]), [["a", "first draft"], ["b", "second draft"]]); saver.dispose();
});

test("every generation input affects staleness, but motivation whitespace does not", () => {
  const snapshot = { resume: "resume", job: "job", mode: "email" as const, language: "en" as const, motivation: "interest", style: "neutral" as const };
  for (const [key, value] of Object.entries({ resume: "other", job: "other", mode: "anschreiben", language: "de", motivation: "other", style: "friendly" })) {
    assert.notEqual(snapshotKey({ ...snapshot, [key]: value }), snapshotKey(snapshot));
  }
  assert.equal(snapshotKey({ ...snapshot, motivation: "  interest  " }), snapshotKey(snapshot));
});

test("leaving after a failed save keeps recovery without blocking saves on another analysis", async () => {
  const recovered: [string, boolean][] = [];
  const saver = new DraftSaver(async draft => { if (draft.id === "deleted") throw new Error("row removed"); }, () => {}, (draft, saved) => recovered.push([draft.id, saved]));
  saver.schedule(edit("recover me", "deleted")); await assert.rejects(saver.flush());
  saver.deferRecovery();
  saver.schedule(edit("new draft", "valid")); await saver.flush();
  assert.deepEqual(recovered, [["deleted", false], ["valid", false], ["valid", true]]);
  saver.dispose();
});
