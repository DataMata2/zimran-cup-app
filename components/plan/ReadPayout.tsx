"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/kit/Button";
import { AiCallError, fileToImage, readPayment, SCREENSHOT_TYPES, type ReadPayment } from "@/lib/product/aiClient";
import type { PaywallReason } from "./Paywall";

const PASTE_MAX = 20_000;

/**
 * "Paste a payout email or screenshot": the model reads amount, client and date, and the log form is filled
 * for the person to check. Nothing is saved here. Pasting text is free; a screenshot needs Pro.
 */
export function ReadPayout({
  pro,
  onNeedPro,
  onRead,
  onClose,
}: {
  pro: boolean;
  onNeedPro: (reason: PaywallReason) => void;
  /** Called with what was found; at least one field is non-null. */
  onRead: (found: ReadPayment) => void;
  onClose: () => void;
}) {
  const ids = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  function pickFile() {
    if (!pro) {
      onNeedPro("screenshot");
      return;
    }
    fileRef.current?.click();
  }

  async function read() {
    setError(null);
    if (!text.trim() && !file) {
      setError("Paste the payout email, or add a screenshot.");
      return;
    }
    let image: { mediaType: string; dataBase64: string } | undefined;
    if (file) {
      const out = await fileToImage(file);
      if ("error" in out) {
        setError(out.error);
        return;
      }
      image = out;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    try {
      const found = await readPayment({ text: text.trim() || undefined, image }, ctrl.signal);
      if (found.amount === null && found.payer === null && found.date === null) {
        setError("Couldn't find a payment in that. Enter it below, or try another email or screenshot.");
        return;
      }
      onRead(found);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      if (err instanceof AiCallError && err.proRequired) {
        setFile(null);
        onNeedPro("screenshot");
        return;
      }
      setError(
        err instanceof AiCallError && err.status === 413
          ? "That's too large to read. Paste less text or use a smaller screenshot."
          : err instanceof AiCallError && err.status === 429
            ? "Too many reads in the last hour. Enter this one by hand."
            : "Couldn't read that right now. Try again, or enter it below.",
      );
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="mt-4 animate-[pp-step-in_250ms_var(--ease-out-soft)_both] rounded-md border border-line-strong bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={`${ids}-paste`} className="text-sm font-semibold text-ink">
          Paste a payout email
        </label>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-2 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <textarea
        id={`${ids}-paste`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        maxLength={PASTE_MAX}
        rows={3}
        placeholder="From Stripe, PayPal, Upwork, your bank or a client"
        className="mt-2 block w-full resize-y rounded-md border border-line-strong bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-ink-2">or</span>
        <input
          ref={fileRef}
          type="file"
          accept={SCREENSHOT_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
            e.target.value = "";
          }}
        />
        {file ? (
          <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-sunken py-1 pr-1 pl-3 text-sm text-ink">
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label={`Remove ${file.name}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-line hover:text-ink"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </span>
        ) : (
          <Button size="sm" variant="secondary" onClick={pickFile}>
            Upload screenshot
            {!pro && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">Pro</span>}
          </Button>
        )}
      </div>

      <p className="mt-2 text-xs text-ink-3">Screenshots: PNG, JPEG, WebP or GIF, up to 4 MB.</p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red">
          {error}
        </p>
      )}

      <Button
        fullWidth
        className="mt-4"
        onClick={() => void read()}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? "Reading…" : "Read it"}
      </Button>
    </div>
  );
}
