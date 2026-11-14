import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  base64DecodedBytes,
  checkImage,
  clientIp,
  GuardError,
  MAX_IMAGE_BYTES,
  RateLimiter,
  readJsonBody,
} from "@/lib/product/ai-guard";
import {
  askSystem,
  dollarAmounts,
  explainUserMessage,
  knownNumbers,
  logFacts,
  MAX_CHAT_CHARS,
  MAX_CHAT_MESSAGES,
  normalizeReadPayment,
  parseChatMessages,
  parsePlanRequest,
  planFacts,
  unknownDollarAmounts,
} from "@/lib/product/ai-prompts";
import { askHandler, readPaymentHandler, explainHandler, type AiDeps } from "@/lib/product/ai-handlers";
import { buildExample } from "@/lib/product/example";
import { money } from "@/lib/product/format";
import type { LogEntry } from "@/lib/product/types";

const ASOF = "2026-11-14";
const { profile, entry } = buildExample(ASOF, new Date("2026-11-14T10:00:00Z"));
const log: LogEntry[] = [{ ...entry, id: "e1", createdAt: "2026-11-03T12:00:00.000Z" }];
const planBody = { profile, log, asOf: ASOF };

const jsonRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** Deps that fail loudly if a gated request ever reaches the model. */
function deps(pro: boolean, limiter = new RateLimiter()): AiDeps & { calls: number } {
  const d = {
    calls: 0,
    model: "test",
    limiter,
    checkPro: async () => pro,
    getClient: (): Anthropic => {
      d.calls += 1;
      throw new Error("model must not be called");
    },
  };
  return d;
}

describe("RateLimiter", () => {
  it("allows the limit per window, then refuses until the window passes", () => {
    let t = 0;
    const rl = new RateLimiter(3, 1000, () => t);
    expect([rl.take("a"), rl.take("a"), rl.take("a"), rl.take("a")]).toEqual([true, true, true, false]);
    expect(rl.take("b")).toBe(true);
    t = 1000;
    expect(rl.take("a")).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the first forwarded address, then x-real-ip, else unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("readJsonBody", () => {
  it("parses a JSON object", async () => {
    expect(await readJsonBody(jsonRequest({ a: 1 }))).toEqual({ a: 1 });
  });
  it("413s a body over the limit, by content-length or by size", async () => {
    await expect(readJsonBody(jsonRequest({ a: "x".repeat(200) }), 100)).rejects.toMatchObject({ status: 413 });
    const lying = jsonRequest({ a: "x".repeat(200) }, { "content-length": "10" });
    await expect(readJsonBody(lying, 100)).rejects.toMatchObject({ status: 413 });
  });
  it("400s non-JSON and non-objects", async () => {
    await expect(readJsonBody(jsonRequest("not json"))).rejects.toMatchObject({ status: 400 });
    await expect(readJsonBody(jsonRequest([1, 2]))).rejects.toMatchObject({ status: 400 });
  });
});

describe("checkImage", () => {
  const png = Buffer.from("fake png bytes").toString("base64");
  it("accepts the four image types and strips a data: prefix", () => {
    expect(checkImage({ mediaType: "image/png", dataBase64: `data:image/png;base64,${png}` })).toEqual({ mediaType: "image/png", dataBase64: png });
    for (const t of ["image/jpeg", "image/webp", "image/gif"]) expect(checkImage({ mediaType: t, dataBase64: png }).mediaType).toBe(t);
  });
  it("rejects other types, bad base64 and images over 5 MB", () => {
    expect(() => checkImage({ mediaType: "image/svg+xml", dataBase64: png })).toThrow(GuardError);
    expect(() => checkImage({ mediaType: "image/png", dataBase64: "not base64!" })).toThrow(GuardError);
    const big = "A".repeat(Math.ceil(((MAX_IMAGE_BYTES + 10) * 4) / 3));
    expect(() => checkImage({ mediaType: "image/png", dataBase64: big })).toThrow(expect.objectContaining({ status: 413 }));
  });
  it("computes decoded size from base64 length", () => {
    expect(base64DecodedBytes(Buffer.from("hello").toString("base64"))).toBe(5);
    expect(base64DecodedBytes(Buffer.from("hell").toString("base64"))).toBe(4);
  });
});

describe("parsePlanRequest", () => {
  it("recomputes the plan on the server from profile + log", () => {
    const { result, input } = parsePlanRequest(planBody);
    expect(input.ytd1099Income).toBe(profile.ytdIncome + entry.amount);
    expect(result.asOf).toBe(ASOF);
  });
  it("400s malformed bodies and inputs the engine rejects", () => {
    expect(() => parsePlanRequest({ ...planBody, profile: { ...profile, ytdIncome: "52000" } })).toThrow(GuardError);
    expect(() => parsePlanRequest({ ...planBody, log: [{ amount: 1 }] })).toThrow(GuardError);
    expect(() => parsePlanRequest({ ...planBody, asOf: "Nov 14" })).toThrow(GuardError);
    expect(() => parsePlanRequest({ ...planBody, asOf: "2031-01-01" })).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe("parseChatMessages", () => {
  it("keeps the last 10, trims each to 1,000 chars, starts with a user turn", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: `m${i}` }));
    const out = parseChatMessages(many);
    expect(out.length).toBeLessThanOrEqual(MAX_CHAT_MESSAGES);
    expect(out[0]!.role).toBe("user");
    expect(out.at(-1)!.content).toBe("m14");
    expect(parseChatMessages([{ role: "user", content: "x".repeat(5000) }])[0]!.content.length).toBe(MAX_CHAT_CHARS);
  });
  it("400s when the last turn is not the user's or roles are wrong", () => {
    expect(() => parseChatMessages([{ role: "user", content: "a" }, { role: "assistant", content: "b" }])).toThrow(GuardError);
    expect(() => parseChatMessages([{ role: "system", content: "a" }])).toThrow(GuardError);
    expect(() => parseChatMessages("hi")).toThrow(GuardError);
  });
});

describe("planFacts", () => {
  const { result } = parsePlanRequest(planBody);
  const facts = planFacts(result, log, profile);
  const json = JSON.stringify(facts);

  it("drops the input echo and method notes", () => {
    expect(json).not.toContain("estimatedPaymentsMade");
    expect(json).not.toContain(result.setAside.method);
  });
  it("carries the screen's numbers as display strings", () => {
    expect(facts.setAside.rate).toMatch(/^\d+%$/);
    expect(facts.safeHarbor.requiredFor2026).toBe(money(result.safeHarbor.requiredAnnualPayment));
    expect(facts.installments).toHaveLength(4);
    // Maya missed Q3: the headline is the pay-now amount.
    expect(facts.headline.says).toMatch(/^Pay \$[\d,]+ now\.$/);
    expect(facts.today).toBe("Nov 14, 2026");
  });
  it("puts the facts into the prompts", () => {
    expect(explainUserMessage(facts)).toContain(facts.safeHarbor.requiredFor2026);
    const sys = askSystem(facts, logFacts(log));
    expect(sys).toContain("Northwind Studio");
    expect(sys).toContain(money(entry.setAside));
  });
});

describe("number post-check", () => {
  it("reads dollar amounts and rounds them to dollars", () => {
    expect(dollarAmounts("Pay $1,234 by Jan 15 and $2,340.50 later, or $7.")).toEqual([1234, 2341, 7]);
  });
  it("knows numbers from the sources with and without cents", () => {
    const known = knownNumbers('{"a":"$1,234","b":"2340.50"}');
    expect(known.has(1234) && known.has(2340) && known.has(2341)).toBe(true);
  });
  it("flags amounts the model made up", () => {
    const facts = '{"pay":"$3,612","rate":"21%"}';
    expect(unknownDollarAmounts("Pay $3,612 now.", facts)).toEqual([]);
    expect(unknownDollarAmounts("Pay $3,612 now, that is $7,224 over two quarters.", facts)).toEqual([7224]);
  });
});

describe("normalizeReadPayment", () => {
  it("keeps valid fields", () => {
    expect(normalizeReadPayment({ amount: 2340, payer: " Acme Co ", date: "2026-11-12" })).toEqual({ amount: 2340, payer: "Acme Co", date: "2026-11-12" });
  });
  it("nulls bad amounts, fake dates and empty payers", () => {
    expect(normalizeReadPayment({ amount: -5, payer: "", date: "2026-02-30" })).toEqual({ amount: null, payer: null, date: null });
    expect(normalizeReadPayment(null)).toEqual({ amount: null, payer: null, date: null });
    expect(normalizeReadPayment({ amount: 10.005, payer: null, date: "11/12/2026" }).date).toBeNull();
  });
});

describe("handlers: gating before the model", () => {
  const png = { mediaType: "image/png", dataBase64: Buffer.from("x").toString("base64") };

  it("ask: 402 pro_required for non-Pro, without calling the model", async () => {
    const d = deps(false);
    const res = await askHandler(d)(jsonRequest({ ...planBody, messages: [{ role: "user", content: "Why?" }] }));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "pro_required" });
    expect(d.calls).toBe(0);
  });
  it("ask: Pro passes the gate and reaches the model (here: a client that throws → 502)", async () => {
    const d = deps(true);
    const res = await askHandler(d)(jsonRequest({ ...planBody, messages: [{ role: "user", content: "Why?" }] }));
    expect(d.calls).toBe(1);
    expect(res.status).toBe(502);
  });
  it("read-payment: an image needs Pro; text does not hit the gate", async () => {
    const d = deps(false);
    const res = await readPaymentHandler(d)(jsonRequest({ image: png }));
    expect(res.status).toBe(402);
    expect(d.calls).toBe(0);
    const t = await readPaymentHandler(d)(jsonRequest({ text: "Stripe payout $10" }));
    expect(t.status).toBe(502); // reached the (throwing) model
    expect(d.calls).toBe(1);
  });
  it("read-payment: 400 with neither text nor image, 400 for a bad image type", async () => {
    const d = deps(true);
    expect((await readPaymentHandler(d)(jsonRequest({}))).status).toBe(400);
    expect((await readPaymentHandler(d)(jsonRequest({ image: { ...png, mediaType: "application/pdf" } }))).status).toBe(400);
  });
  it("explain: 400 on a malformed plan body", async () => {
    const res = await explainHandler(deps(false))(jsonRequest({ profile: {}, log: [], asOf: ASOF }));
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });
  it("429 after 60 requests from one IP across routes", async () => {
    const limiter = new RateLimiter(60, 3_600_000);
    const d = deps(false, limiter);
    for (let i = 0; i < 60; i++) await explainHandler(d)(jsonRequest({}));
    expect((await askHandler(d)(jsonRequest({}))).status).toBe(429);
    expect((await askHandler(d)(jsonRequest({}, { "x-forwarded-for": "198.51.100.1" }))).status).toBe(400);
  });
});
