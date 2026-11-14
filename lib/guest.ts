import "server-only";
import { cookies } from "next/headers";
import { ensureGuest } from "@/lib/supabase";

/** Name of the httpOnly cookie holding the guest id. */
export const GUEST_COOKIE = "guest_id";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the guest id from the cookie (any server context); null if absent or malformed. */
export async function getGuestId(): Promise<string | null> {
  const value = (await cookies()).get(GUEST_COOKIE)?.value;
  return value && UUID_RE.test(value) ? value : null;
}

/** Returns the guest id, creating cookie + DB row if needed. Route handlers / server actions only. */
export async function getOrCreateGuestId(): Promise<string> {
  const existing = await getGuestId();
  const id = existing ?? crypto.randomUUID();
  if (!existing) {
    (await cookies()).set(GUEST_COOKIE, id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
    });
  }
  await ensureGuest(id);
  return id;
}
