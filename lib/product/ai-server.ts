// Server wiring for the AI routes: the skeleton's Anthropic client and the Pro check from the guest cookie.
import "server-only";
import { getAnthropic, MODEL } from "@/lib/ai";
import { getGuestId } from "@/lib/guest";
import { isPro } from "@/lib/supabase";
import type { AiDeps } from "./ai-handlers";

/** Pro is the server's truth: the guest cookie and its database row. No guest, or any failure, is not Pro. */
async function checkPro(): Promise<boolean> {
  try {
    const guestId = await getGuestId();
    return guestId ? await isPro(guestId) : false;
  } catch (err) {
    console.error("Pro check failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export const aiDeps: AiDeps = { getClient: getAnthropic, model: MODEL, checkPro };
