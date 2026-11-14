"use server";

import { redirect } from "next/navigation";
import { getOrCreateGuestId } from "@/lib/guest";

/** Server action: starts guest mode (no sign-up) and opens the plan page. */
export async function startGuest() {
  await getOrCreateGuestId();
  redirect("/plan");
}
