// Browser side of the AI routes: stream plain text from /api/explain and /api/ask, read a payout with
// /api/read-payment, and turn a picked file into the request's image. No tax numbers here.

import type { LogEntry, Profile } from "./types";

/** What the AI routes need to recompute the plan on the server. */
export interface PlanBody {
  profile: Profile;
  log: readonly LogEntry[];
  asOf: string;
}

/** A failed AI call: `proRequired` when the server says the feature needs Pro (402). */
export class AiCallError extends Error {
  constructor(
    readonly status: number,
    readonly proRequired = false,
  ) {
    super(`AI request failed (${status})`);
    this.name = "AiCallError";
  }
}

async function post(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new AiCallError(res.status, res.status === 402 && err?.error === "pro_required");
  }
  return res;
}

/**
 * POST and read the plain-text stream; `onText` gets the whole text so far after every chunk. Resolves with
 * the full text. Throws AiCallError (or the AbortError when `signal` aborts).
 */
export async function streamText(
  url: "/api/explain" | "/api/ask",
  body: unknown,
  onText: (textSoFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await post(url, body, signal);
  if (!res.body) throw new AiCallError(502);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  text += decoder.decode();
  if (!text.trim()) throw new AiCallError(502);
  onText(text);
  return text;
}

export interface ReadPayment {
  amount: number | null;
  payer: string | null;
  date: string | null;
}

export async function readPayment(
  input: { text?: string; image?: { mediaType: string; dataBase64: string } },
  signal?: AbortSignal,
): Promise<ReadPayment> {
  const res = await post("/api/read-payment", input, signal);
  return (await res.json()) as ReadPayment;
}

export const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

/** A picked file as the request's image, or a message saying why it can't be used. */
export async function fileToImage(file: File): Promise<{ mediaType: string; dataBase64: string } | { error: string }> {
  if (!SCREENSHOT_TYPES.includes(file.type)) return { error: "Use a PNG, JPEG, WebP or GIF screenshot." };
  if (file.size > SCREENSHOT_MAX_BYTES) return { error: "That screenshot is over 5 MB. Crop it or use a smaller one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { mediaType: file.type, dataBase64: btoa(binary) };
}
