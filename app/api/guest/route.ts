import { getOrCreateGuestId } from "@/lib/guest";

/** POST /api/guest: ensures a guest cookie + row exists, returns { guestId }. */
export async function POST() {
  try {
    const guestId = await getOrCreateGuestId();
    return Response.json({ guestId });
  } catch (err) {
    console.error("POST /api/guest failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not create guest" }, { status: 500 });
  }
}
