// Request handlers for the AI routes, with their dependencies passed in (the Anthropic client, the Pro check,
// the limiter) so the route files stay one line and the gating can be tested without Next or the network.
// Rule: our code calculates, the model explains. Every route recomputes the plan from { profile, log, asOf }.

import type Anthropic from "@anthropic-ai/sdk";
import { aiLimits, checkImage, clientIp, GuardError, guardResponse, RATE_LIMITED_MESSAGE, readJsonBody, type AiLimits } from "./ai-guard";
import {
  ASK_DISCLAIMER,
  askSystem,
  EXPLAIN_SYSTEM,
  explainUserMessage,
  logFacts,
  MAX_PASTE_CHARS,
  normalizeReadPayment,
  parseChatMessages,
  parsePlanRequest,
  planFacts,
  READ_PAYMENT_SCHEMA,
  READ_PAYMENT_SYSTEM,
  unknownDollarAmounts,
} from "./ai-prompts";

export interface AiDeps {
  getClient: () => Anthropic;
  model: string;
  /** Is the caller Pro? Server-side truth (guest cookie + database). */
  checkPro: () => Promise<boolean>;
  /** The caller's guest id from the cookie, or null (rate limiting then keys on the IP). */
  getGuestId?: () => Promise<string | null>;
  limits?: AiLimits;
  /** Where post-check warnings go (default console.warn). */
  warn?: (message: string, detail?: unknown) => void;
}

// Sonnet 5.5 on the Claude API: server-side fallback on a refusal, so a false-positive decline still answers.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

const NO_STORE = { "cache-control": "no-store" };
const TEXT_HEADERS = { "content-type": "text/plain; charset=utf-8", ...NO_STORE, "x-content-type-options": "nosniff" };

const errorJson = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

/** Rate limit and body, shared by every AI route. */
async function admit(request: Request, deps: AiDeps): Promise<Record<string, unknown>> {
  const guestId = deps.getGuestId ? await deps.getGuestId().catch(() => null) : null;
  if (!(deps.limits ?? aiLimits).take({ guestId, ip: clientIp(request.headers) })) {
    throw new GuardError(429, RATE_LIMITED_MESSAGE);
  }
  return readJsonBody(request);
}

async function withGuard(fn: () => Promise<Response>, route: string): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    console.error(`${route} failed:`, err instanceof Error ? err.message : err);
    return errorJson(502, "The AI service is unavailable. Try again.");
  }
}

/**
 * Stream a beta message as plain text. Waits for the first text so an API failure before any output becomes a
 * 502 instead of a broken 200; after the stream ends, `onDone` gets the full text (post-check) and may
 * return a suffix to append.
 */
async function textResponse(
  stream: ReturnType<Anthropic["beta"]["messages"]["stream"]>,
  onDone: (text: string) => string | void,
): Promise<Response> {
  const encoder = new TextEncoder();
  const iterator = textDeltas(stream)[Symbol.asyncIterator]();
  const first = await iterator.next(); // throws on an immediate API error → 502 via withGuard
  let full = first.done ? "" : first.value;
  if (first.done) throw new Error("Model returned no text");

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(first.value));
    },
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) {
          const suffix = onDone(full);
          if (suffix) controller.enqueue(encoder.encode(suffix));
          controller.close();
          return;
        }
        full += next.value;
        controller.enqueue(encoder.encode(next.value));
      } catch (err) {
        console.error("AI stream failed:", err instanceof Error ? err.message : err);
        controller.error(err);
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(body, { headers: TEXT_HEADERS });
}

async function* textDeltas(stream: ReturnType<Anthropic["beta"]["messages"]["stream"]>): AsyncGenerator<string> {
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
      yield event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new Error("Model declined the request");
  if (final.stop_reason === "max_tokens") console.warn(`AI stream hit max_tokens (${final.usage.output_tokens} output tokens); the text was cut off.`);
}

function postCheck(deps: AiDeps, route: string, text: string, sources: string[]) {
  const unknown = unknownDollarAmounts(text, ...sources);
  if (unknown.length > 0) {
    (deps.warn ?? console.warn)(`${route}: amounts not in the plan: ${unknown.map((n) => `$${n}`).join(", ")}`, { text });
  }
}

/** POST /api/explain `{ profile, log, asOf }` → 4–6 sentences explaining the plan, streamed as plain text. */
export function explainHandler(deps: AiDeps) {
  return (request: Request) =>
    withGuard(async () => {
      const body = await admit(request, deps);
      const { profile, log, result } = parsePlanRequest(body);
      const facts = planFacts(result, log, profile);
      const user = explainUserMessage(facts);
      const stream = deps.getClient().beta.messages.stream({
        model: deps.model,
        max_tokens: 2048,
        output_config: { effort: "low" },
        system: EXPLAIN_SYSTEM,
        messages: [{ role: "user", content: user }],
        ...FALLBACK,
      }, { signal: request.signal });
      return textResponse(stream, (text) => postCheck(deps, "explain", text, [user]));
    }, "POST /api/explain");
}

/**
 * POST /api/ask (Pro) `{ profile, log, asOf, messages }` → a short grounded answer, streamed, ending with
 * "Estimate, not tax advice." Not Pro → 402 `{ error: "pro_required" }`.
 */
export function askHandler(deps: AiDeps) {
  return (request: Request) =>
    withGuard(async () => {
      const body = await admit(request, deps);
      const { profile, log, result } = parsePlanRequest(body);
      const messages = parseChatMessages(body.messages);
      if (!(await deps.checkPro())) return errorJson(402, "pro_required");

      const facts = planFacts(result, log, profile);
      const system = askSystem(facts, logFacts(log), profile.isExample ? "Start with my own numbers" : "Edit my answers");
      const stream = deps.getClient().beta.messages.stream({
        model: deps.model,
        max_tokens: 2048,
        output_config: { effort: "low" },
        system,
        messages,
        ...FALLBACK,
      }, { signal: request.signal });
      return textResponse(stream, (text) => {
        postCheck(deps, "ask", text, [system, ...messages.map((m) => m.content)]);
        return `\n\n${ASK_DISCLAIMER}`;
      });
    }, "POST /api/ask");
}

/**
 * POST /api/read-payment `{ text?, image?: { mediaType, dataBase64 } }` → `{ amount, payer, date }` (each may
 * be null). Text is free; an image needs Pro (402 `{ error: "pro_required" }`). Never saves anything.
 */
export function readPaymentHandler(deps: AiDeps) {
  return (request: Request) =>
    withGuard(async () => {
      const body = await admit(request, deps);
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (text.length > MAX_PASTE_CHARS) throw new GuardError(413, "Pasted text is too long.");
      const image = body.image === undefined || body.image === null ? null : checkImage(body.image);
      if (!text && !image) throw new GuardError(400, "Paste the payout text or add a screenshot.");
      if (image && !(await deps.checkPro())) return errorJson(402, "pro_required");

      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (image) {
        content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.dataBase64 } });
      }
      content.push({
        type: "text",
        text: text ? `<payout>\n${text}\n</payout>\n\nRead this payout.` : "Read the payout in this screenshot.",
      });

      const message = await deps.getClient().beta.messages.create({
        model: deps.model,
        max_tokens: 2048,
        output_config: { effort: "low", format: { type: "json_schema", schema: READ_PAYMENT_SCHEMA } },
        system: READ_PAYMENT_SYSTEM,
        messages: [{ role: "user", content }],
        ...FALLBACK,
      }, { signal: request.signal });
      if (message.stop_reason === "max_tokens") console.warn("read-payment hit max_tokens; the JSON may be cut off.");
      const empty = { amount: null, payer: null, date: null };
      if (message.stop_reason === "refusal") return Response.json(empty, { headers: NO_STORE });
      const out = message.content.find((b) => b.type === "text");
      let parsed: unknown = null;
      try {
        parsed = out && out.type === "text" ? JSON.parse(out.text) : null;
      } catch {
        parsed = null;
      }
      return Response.json(normalizeReadPayment(parsed), { headers: NO_STORE });
    }, "POST /api/read-payment");
}
