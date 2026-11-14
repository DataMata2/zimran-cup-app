// Shared guard for the AI routes (/api/explain, /api/read-payment, /api/ask): body size, a per-IP request
// budget, and the image rules for screenshot reading. Pure apart from the in-memory counter; no Next imports,
// so it is unit-tested directly.

/** Largest request body the AI routes read (bytes). Bigger bodies get 413. */
export const MAX_BODY_BYTES = 6 * 1024 * 1024;
/** Largest screenshot, decoded (bytes). The client caps uploads lower (4.4 MB) so the base64 body fits 6 MB. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Requests per guest per window, across all AI routes (keyed by IP when there is no guest cookie). */
export const GUEST_LIMIT = 40;
/** Requests per IP per window: a ceiling for many guests behind one address (judges share a venue IP). */
export const IP_LIMIT = 300;
/** Requests per window for the whole process. */
export const GLOBAL_LIMIT = 1_500;
export const RATE_WINDOW_MS = 60 * 60 * 1000;
export const RATE_LIMITED_MESSAGE = "Too many requests right now. Try again in a few minutes.";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ImageMediaType = (typeof IMAGE_TYPES)[number];

export class GuardError extends Error {
  constructor(
    readonly status: 400 | 402 | 413 | 429,
    message: string,
  ) {
    super(message);
    this.name = "GuardError";
  }
}

/** JSON error response for a guard failure: `{ error }` with the guard's status. */
export function guardResponse(err: GuardError): Response {
  return Response.json({ error: err.message }, { status: err.status, headers: { "cache-control": "no-store" } });
}

/**
 * Fixed-window counter per key. Good enough for one server process: it resets on restart and is not shared
 * between instances (the brief asks for "rate-limit-ish").
 */
export class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit = GUEST_LIMIT,
    private readonly windowMs = RATE_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Would one more request for `key` fit in its budget for the current window? Counts nothing. */
  allows(key: string): boolean {
    const entry = this.hits.get(key);
    return !entry || this.now() - entry.start >= this.windowMs || entry.count < this.limit;
  }

  /** Count one request for `key`; false (and nothing counted) when the key is over its budget. */
  take(key: string): boolean {
    if (!this.allows(key)) return false;
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || t - entry.start >= this.windowMs) {
      this.hits.set(key, { start: t, count: 1 });
      this.sweep(t);
    } else {
      entry.count += 1;
    }
    return true;
  }

  /** Drop expired windows so the map can't grow without bound. */
  private sweep(t: number) {
    if (this.hits.size < 5_000) return;
    for (const [k, v] of this.hits) if (t - v.start >= this.windowMs) this.hits.delete(k);
  }
}

/**
 * The three budgets of the AI routes: per guest (the guest cookie, or the IP without one), per IP, and
 * global. A request is counted against all three only when all three allow it.
 */
export class AiLimits {
  constructor(
    readonly guest = new RateLimiter(GUEST_LIMIT),
    readonly ip = new RateLimiter(IP_LIMIT),
    readonly global = new RateLimiter(GLOBAL_LIMIT),
  ) {}

  take({ guestId, ip }: { guestId: string | null; ip: string }): boolean {
    const guestKey = guestId ? `guest:${guestId}` : `ip:${ip}`;
    if (!this.global.allows("all") || !this.ip.allows(ip) || !this.guest.allows(guestKey)) return false;
    this.global.take("all");
    this.ip.take(ip);
    this.guest.take(guestKey);
    return true;
  }
}

/** One set of limits for every AI route in this process. */
export const aiLimits = new AiLimits();

/** The caller's IP from the proxy headers, or "unknown" (all unknown callers share one budget). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Read and parse the JSON body under the size limit. Throws GuardError 413 when it is too big (by
 * content-length or by actual size) and 400 when it is not a JSON object.
 */
export async function readJsonBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new GuardError(413, "Request is too large.");

  let text: string;
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new GuardError(413, "Request is too large.");
      }
      chunks.push(value);
    }
    const all = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      all.set(c, offset);
      offset += c.byteLength;
    }
    text = new TextDecoder().decode(all);
  } else {
    text = "";
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new GuardError(400, "Body must be JSON.");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new GuardError(400, "Body must be a JSON object.");
  return value as Record<string, unknown>;
}

/** Size in bytes of the data a base64 string decodes to. */
export function base64DecodedBytes(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export interface CheckedImage {
  mediaType: ImageMediaType;
  dataBase64: string;
}

/**
 * Validate a screenshot from the body: an allowed media type, plain base64 (a `data:` URL prefix is
 * stripped), at most MAX_IMAGE_BYTES decoded. Throws GuardError 400 / 413.
 */
export function checkImage(value: unknown): CheckedImage {
  if (typeof value !== "object" || value === null) throw new GuardError(400, "image must be { mediaType, dataBase64 }.");
  const { mediaType, dataBase64 } = value as Record<string, unknown>;
  if (typeof mediaType !== "string" || !(IMAGE_TYPES as readonly string[]).includes(mediaType)) {
    throw new GuardError(400, "Use a PNG, JPEG, WebP or GIF screenshot.");
  }
  if (typeof dataBase64 !== "string" || dataBase64.length === 0) throw new GuardError(400, "image.dataBase64 is missing.");
  const data = dataBase64.replace(/^data:[^;,]+;base64,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new GuardError(400, "image.dataBase64 is not base64.");
  if (base64DecodedBytes(data) > MAX_IMAGE_BYTES) throw new GuardError(413, "Screenshot is over 5 MB.");
  if (!matchesMagic(mediaType as ImageMediaType, data)) throw new GuardError(400, "That file doesn't look like an image.");
  return { mediaType: mediaType as ImageMediaType, dataBase64: data };
}

/** First bytes of a base64 string (decodes only the first 24 characters). */
function headBytes(b64: string): number[] {
  try {
    // 24 base64 characters are exactly 18 bytes; a shorter string is decoded whole (it is already padded).
    return Array.from(atob(b64.length > 24 ? b64.slice(0, 24) : b64), (c) => c.charCodeAt(0));
  } catch {
    return [];
  }
}

const startsWith = (bytes: number[], sig: readonly number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

/** Does the data start with the signature of the declared image type? */
export function matchesMagic(mediaType: ImageMediaType, b64: string): boolean {
  const h = headBytes(b64);
  switch (mediaType) {
    case "image/png":
      return startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith(h, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return startsWith(h, ascii("GIF87a")) || startsWith(h, ascii("GIF89a"));
    case "image/webp":
      return startsWith(h, ascii("RIFF")) && startsWith(h, ascii("WEBP"), 8);
  }
}
