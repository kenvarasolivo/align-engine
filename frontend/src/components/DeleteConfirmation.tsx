import { useEffect, useId, useRef, useState } from "react";
import type { Language } from "../types";

interface Props {
  language: Language;
  itemName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/** Native modal provides focus trapping, Escape handling and an inert backdrop. */
export default function DeleteConfirmation({ language, itemName, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const de = language === "de";

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    cancel.current?.focus();
    return () => {
      modal?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await onConfirm();
      onCancel();
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      className="w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-hairline bg-panel p-6 text-charcoal shadow-card backdrop:bg-black/50">
      <h2 id={titleId} className="text-lg font-bold text-obsidian">{de ? "Endgültig löschen?" : "Delete permanently?"}</h2>
      <p className="mt-3 break-words text-sm font-semibold">{itemName}</p>
      <p id={descriptionId} className="mt-2 text-sm text-charcoal/65">
        {de ? "Dieser Vorgang kann nicht rückgängig gemacht werden." : "This action cannot be undone."}
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{de ? "Löschen fehlgeschlagen. Bitte erneut versuchen." : "Could not delete. Please try again."}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button ref={cancel} type="button" disabled={busy} onClick={onCancel} className="btn-secondary min-h-10 px-4 text-sm">{de ? "Abbrechen" : "Cancel"}</button>
        <button type="button" disabled={busy} onClick={() => void confirm()} className="btn-danger min-h-10 px-4 text-sm">
          {busy ? (de ? "Wird gelöscht…" : "Deleting…") : (de ? "Löschen" : "Delete")}
        </button>
      </div>
    </dialog>
  );
}
