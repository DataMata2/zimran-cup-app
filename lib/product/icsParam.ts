// The `d` parameter of GET /api/ics: the engine input as base64url-encoded JSON (UTF-8).
// Shared by the page (encode) and the route handler (decode), and safe in both the browser and Node.

import type { TaxInput } from "@/lib/tax";

/** Longest `d` the route accepts. A real input is a few hundred characters; this leaves room for long logs. */
export const ICS_PARAM_MAX_LENGTH = 16_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function encodeIcsParam(input: TaxInput): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(input)));
}

/**
 * Decode `d` back to an object. Returns null for anything that is not base64url JSON of a plain object
 * (or is too long). The engine still validates the fields; this only checks the envelope.
 */
export function decodeIcsParam(d: string | null | undefined): TaxInput | null {
  if (!d || d.length > ICS_PARAM_MAX_LENGTH || !/^[A-Za-z0-9_-]+$/.test(d)) return null;
  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(d));
    const value: unknown = JSON.parse(json);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return value as TaxInput;
  } catch {
    return null;
  }
}

/** URL of the calendar file for this input. */
export function icsHref(input: TaxInput): string {
  return `/api/ics?d=${encodeIcsParam(input)}`;
}
