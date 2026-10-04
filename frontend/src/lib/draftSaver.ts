import type { DraftDocument } from "../types";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
export interface DraftEdit { id: string; text: string; document: DraftDocument | null }

/** One writer serializes saves so slower requests cannot overwrite newer edits. */
export class DraftSaver {
  private pending = new Map<string, DraftEdit>();
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  status: SaveStatus = "idle";
  constructor(
    private write: (edit: DraftEdit) => Promise<void>,
    private changed: (status: SaveStatus) => void,
    private recover: (edit: DraftEdit, saved: boolean) => void,
  ) {}
  private notify(status: SaveStatus) { this.status = status; this.changed(status); }
  get dirty() { return this.pending.size > 0 || this.running !== null; }
  schedule(edit: DraftEdit) {
    this.pending.set(edit.id, edit);
    this.recover(edit, false);
    this.notify("pending");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush().catch(() => {}); }, 1200);
  }
  flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.running) return this.running;
    if (!this.pending.size) return Promise.resolve();
    this.notify("saving");
    this.running = this.drain().finally(() => { this.running = null; });
    return this.running;
  }
  private async drain() {
    try {
      while (this.pending.size) {
        const [id, edit] = this.pending.entries().next().value as [string, DraftEdit];
        await this.write(edit);
        // Edits arriving during this write stay queued and are saved next.
        if (this.pending.get(id) === edit) {
          this.pending.delete(id);
          this.recover(edit, true);
        }
      }
      this.notify("saved");
    } catch (error) { this.notify("error"); throw error; }
  }
  dispose() { if (this.timer) clearTimeout(this.timer); }
  /** Explicitly leave unsent edits in recovery storage, without blocking new rows. */
  deferRecovery() {
    if (this.running) throw new Error("Cannot defer an active save");
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.pending.clear();
    this.notify("idle");
  }
}

function recoveryKey(userId: string, id: string) { return `align_draft_recovery:${userId}:${id}`; }
export function storeRecovery(userId: string, edit: DraftEdit, saved: boolean) {
  try {
    if (saved) localStorage.removeItem(recoveryKey(userId, edit.id));
    else localStorage.setItem(recoveryKey(userId, edit.id), JSON.stringify(edit));
  } catch { /* Saving remotely still works when browser storage is unavailable. */ }
}
export function readRecovery(userId: string, id: string): DraftEdit | null {
  try {
    const value = JSON.parse(localStorage.getItem(recoveryKey(userId, id)) ?? "null");
    if (value?.id !== id || typeof value.text !== "string") return null;
    return { id, text: value.text, document: value.document?.type === "doc" ? value.document : null };
  } catch { return null; }
}
export function hasRecovery(userId: string): boolean {
  try { return Object.keys(localStorage).some(key => key.startsWith(`align_draft_recovery:${userId}:`)); }
  catch { return false; }
}
