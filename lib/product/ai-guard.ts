// Shared guard for the AI routes (/api/explain, /api/read-payment, /api/ask): body size, a per-IP request
// budget, and the image rules for screenshot reading. Pure apart from the in-memory counter; no Next imports,
// so it is unit-tested directly.

/** Largest request body the AI routes read (bytes). Bigger bodies get 413. */
export const MAX_BODY_BYTES = 6 * 1024 * 1024;
/** Largest screenshot, decoded (bytes). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Requests per IP per window, across all AI routes. */
export const RATE_LIMIT = 60;
export const RATE_WINDOW_MS = 60 * 60 * 1000;

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
    private readonly limit = RATE_LIMIT,
    private readonly windowMs = RATE_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Count one request for `key`; false when the key is over its budget for the current window. */
  take(key: string): boolean {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || t - entry.start >= this.windowMs) {
      this.hits.set(key, { start: t, count: 1 });
      this.sweep(t);
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }

  /** Drop expired windows so the map can't grow without bound. */
  private sweep(t: number) {
    if (this.hits.size < 5_000) return;
    for (const [k, v] of this.hits) if (t - v.start >= this.windowMs) this.hits.delete(k);
  }
}

/** One limiter for every AI route in this process. */
export const aiLimiter = new RateLimiter();

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
  return { mediaType: mediaType as ImageMediaType, dataBase64: data };
}
