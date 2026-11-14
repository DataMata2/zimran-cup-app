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
  type ChatMessage,
} from "./ai-prompts";
import { safeAskAnswer, stricterInstruction, templateExplanation, unknownNumbers } from "./ai-numbers";

export interface AiDeps {
  getClient: () => Anthropic;
  model: string;
  /** Is the caller Pro? Server-side truth (guest cookie + database). */
  checkPro: () => Promise<boolean>;
  /** The caller's guest id from the cookie, or null (rate limiting then keys on the IP). */
  getGuestId?: () => Promise<string | null>;
  limits?: AiLimits;
  /** Where number-guard warnings go (default console.warn). */
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

async function withGuard(fn: () => Promise<Response>, route: string, request?: Request): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    // The client went away (closed the card, navigated) while the answer was being written: nothing to log.
    if (request?.signal.aborted) return new Response(null, { status: 499, headers: NO_STORE });
    console.error(`${route} failed:`, err instanceof Error ? err.message : err);
    return errorJson(502, "The AI service is unavailable. Try again.");
  }
}

type BetaStream = ReturnType<Anthropic["beta"]["messages"]["stream"]>;

async function* textDeltas(stream: BetaStream): AsyncGenerator<string> {
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
      yield event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new Error("Model declined the request");
  if (final.stop_reason === "max_tokens") console.warn(`AI stream hit max_tokens (${final.usage.output_tokens} output tokens); the text was cut off.`);
}

/** Run one model call and buffer its whole text (it is short). Throws on an API error, a refusal or no text. */
async function generate(deps: AiDeps, request: Request, system: string, messages: ChatMessage[]): Promise<string> {
  const stream = deps.getClient().beta.messages.stream({
    model: deps.model,
    max_tokens: 2048,
    output_config: { effort: "low" },
    system,
    messages,
    ...FALLBACK,
  }, { signal: request.signal });
  let text = "";
  try {
    for await (const chunk of textDeltas(stream)) text += chunk;
  } catch (err) {
    stream.abort();
    throw err;
  }
  if (!text.trim()) throw new Error("Model returned no text");
  return text;
}

/**
 * The number guard (see ./ai-numbers): buffer the answer, check every number against the facts, regenerate
 * once with the exact figures when one is unknown, and fall back to `fallback()` (built from the engine's
 * own strings) when the retry fails too. Only text that passed, or the fallback, is returned.
 */
async function guardedText(opts: {
  deps: AiDeps;
  request: Request;
  route: string;
  system: string;
  messages: ChatMessage[];
  /** What the model was given: its numbers are the allowed set. */
  facts: string[];
  /** What the person typed (Ask): any number in it is allowed. */
  loose?: string[];
  fallback: () => string;
}): Promise<{ text: string; outcome: GuardOutcome }> {
  const { deps, request, route, system, messages, facts, loose = [], fallback } = opts;
  const warn = deps.warn ?? console.warn;
  const first = await generate(deps, request, system, messages);
  const unknown = unknownNumbers(first, facts, loose);
  if (unknown.length === 0) return { text: first, outcome: "clean" };
  warn(`${route}: numbers not in the plan, regenerating: ${unknown.map((n) => n.raw).join(", ")}`);

  let second: string | null = null;
  try {
    second = await generate(deps, request, system + stricterInstruction(facts, unknown), messages);
  } catch (err) {
    if (request.signal.aborted) throw err;
    warn(`${route}: retry failed, using the template`, err instanceof Error ? err.message : err);
  }
  if (second !== null) {
    const again = unknownNumbers(second, facts, loose);
    if (again.length === 0) return { text: second, outcome: "retried" };
    warn(`${route}: numbers not in the plan after the retry, using the template: ${again.map((n) => n.raw).join(", ")}`);
  }
  return { text: fallback(), outcome: "template" };
}

/** Which path the answer took through the guard; sent as the `x-guard` response header. */
export type GuardOutcome = "clean" | "retried" | "template";

/** Characters per chunk when the checked text is streamed out (keeps the client's typing effect). */
const CHUNK_CHARS = 24;

/** Send already-checked text as a plain-text stream in small chunks. */
function checkedTextResponse(text: string, outcome: GuardOutcome): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= text.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(text.slice(i, i + CHUNK_CHARS)));
      i += CHUNK_CHARS;
    },
  });
  return new Response(body, { headers: { ...TEXT_HEADERS, "x-guard": outcome } });
}

/** POST /api/explain `{ profile, log, asOf }` → 4–6 sentences explaining the plan, checked, then sent as plain text. */
export function explainHandler(deps: AiDeps) {
  return (request: Request) =>
    withGuard(async () => {
      const body = await admit(request, deps);
      const { profile, log, result } = parsePlanRequest(body);
      const facts = planFacts(result, log, profile);
      const user = explainUserMessage(facts);
      const { text, outcome } = await guardedText({
        deps,
        request,
        route: "explain",
        system: EXPLAIN_SYSTEM,
        messages: [{ role: "user", content: user }],
        facts: [user],
        fallback: () => templateExplanation(facts),
      });
      return checkedTextResponse(text, outcome);
    }, "POST /api/explain", request);
}

/**
 * POST /api/ask (Pro) `{ profile, log, asOf, messages }` → a short grounded answer, checked, then sent,
 * ending with "Estimate, not tax advice." Not Pro → 402 `{ error: "pro_required" }`.
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
      const question = messages[messages.length - 1]!.content;
      const { text, outcome } = await guardedText({
        deps,
        request,
        route: "ask",
        system,
        messages,
        facts: [system],
        // Only what the person typed vouches loosely; earlier assistant turns do not.
        loose: messages.filter((m) => m.role === "user").map((m) => m.content),
        fallback: () => safeAskAnswer(facts, question),
      });
      return checkedTextResponse(`${text.trim()}\n\n${ASK_DISCLAIMER}`, outcome);
    }, "POST /api/ask", request);
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
    }, "POST /api/read-payment", request);
}
