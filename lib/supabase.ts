import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null | undefined;

/** True when both Supabase URL and service role key are set. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Server-only admin client (service role, bypasses RLS); null when unconfigured. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  admin = isSupabaseConfigured()
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
  return admin;
}

/** Inserts the guest row if it does not exist yet; no-op without Supabase. */
export async function ensureGuest(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;
  const { error } = await db.from("guests").upsert({ id }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`ensureGuest failed: ${error.message}`);
}

/** True if the guest has the Pro plan; false when unknown or Supabase is unconfigured. */
export async function isPro(guestId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { data, error } = await db.from("guests").select("plan").eq("id", guestId).maybeSingle();
  if (error) {
    console.error("isPro failed:", error.message);
    return false;
  }
  return data?.plan === "pro";
}

/** Marks the guest as Pro (idempotent; keeps the original pro_since). Throws without Supabase. */
export async function setPro(
  guestId: string,
  { stripeSessionId, stripeCustomerId }: { stripeSessionId: string; stripeCustomerId: string | null },
): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) throw new Error("Supabase is not configured");
  await ensureGuest(guestId);
  const { data: existing } = await db.from("guests").select("plan").eq("id", guestId).maybeSingle();
  const update: Record<string, string | null> = {
    plan: "pro",
    stripe_session_id: stripeSessionId,
    stripe_customer_id: stripeCustomerId,
  };
  if (existing?.plan !== "pro") update.pro_since = new Date().toISOString();
  const { error } = await db.from("guests").update(update).eq("id", guestId);
  if (error) throw new Error(`setPro failed: ${error.message}`);
}
