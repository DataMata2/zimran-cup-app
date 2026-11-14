import { connection } from "next/server";
import { getAnthropic, MODEL } from "@/lib/ai";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

type Check = { ok: boolean; ms: number; error?: string };

const TIMEOUT_MS = 8000;
const SECRET_ENV = ["ANTHROPIC_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY"];

/** Strips secret values and key-like tokens from an error message. */
function sanitize(message: string): string {
  let out = message;
  for (const name of SECRET_ENV) {
    const value = process.env[name];
    if (value) out = out.split(value).join("[redacted]");
  }
  return out
    .replace(/(sk|pk|rk|whsec)_(test|live)?_?[A-Za-z0-9]+/g, "[redacted]")
    .replace(/sk-[a-z]{3}-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 300);
}

/** Runs fn with a timeout and reports { ok, ms, error? }. */
async function timed(fn: () => Promise<void>): Promise<Check> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
      }),
    ]);
    return { ok: true, ms: Date.now() - start };
  } catch (err) {
    return { ok: false, ms: Date.now() - start, error: sanitize(err instanceof Error ? err.message : String(err)) };
  } finally {
    clearTimeout(timer);
  }
}

async function checkAnthropic() {
  await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 5,
    messages: [{ role: "user", content: "ping" }],
  });
}

async function checkSupabase() {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("not configured");
  const { data, error } = await db.from("health_checks").insert({}).select("id").single();
  if (error) throw new Error(`insert: ${error.message}`);
  const { data: row, error: readError } = await db.from("health_checks").select("id").eq("id", data.id).single();
  if (readError || !row) throw new Error(`select: ${readError?.message ?? "row not found"}`);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db.from("health_checks").delete().lt("at", cutoff);
}

async function checkStripe() {
  const balance = await getStripe().balance.retrieve();
  if (balance.livemode) throw new Error("Stripe is in live mode");
}

/** GET /api/health: checks Anthropic, Supabase and Stripe; 200 if all ok, else 503. */
export async function GET() {
  await connection();
  const [anthropic, supabase, stripe] = await Promise.all([
    timed(checkAnthropic),
    isSupabaseConfigured() ? timed(checkSupabase) : Promise.resolve<Check>({ ok: false, ms: 0, error: "not configured" }),
    timed(checkStripe),
  ]);
  const checks = { anthropic, supabase, stripe };
  const ok = Object.values(checks).every((c) => c.ok);
  return Response.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
