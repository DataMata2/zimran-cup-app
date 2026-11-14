import { connection } from "next/server";
import { getGuestId } from "@/lib/guest";
import { isPro } from "@/lib/supabase";

const answer = (pro: boolean) => Response.json({ pro }, { headers: { "cache-control": "no-store" } });

/** GET /api/pro: { pro } for this browser's guest. No guest yet, or any failure, answers { pro: false }. */
export async function GET() {
  // Per-request answer: never prerender it (and don't let the try below swallow the prerender bail-out).
  await connection();
  try {
    const guestId = await getGuestId();
    if (!guestId) return answer(false);
    return answer(await isPro(guestId));
  } catch (err) {
    console.error("GET /api/pro failed:", err instanceof Error ? err.message : err);
    return answer(false);
  }
}
