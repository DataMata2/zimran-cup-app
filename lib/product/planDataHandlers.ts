// GET / PUT /api/plan-data: the server copy of the guest's plan. Dependencies are passed in, so the handlers
// are unit-tested without Next or Supabase; app/api/plan-data/route.ts wires the real ones.

import { clientIp, GuardError, guardResponse, RateLimiter, readJsonBody } from "./ai-guard";
import { isClearedPlan, parsePlanData, PLAN_DATA_MAX_BYTES } from "./planData";

export interface PlanDataDeps {
  /** The guest id from the cookie, or null (GET never creates a guest). */
  getGuestId: () => Promise<string | null>;
  /** The guest id, creating the cookie and the guest row if needed (PUT). */
  getOrCreateGuestId: () => Promise<string>;
  load: (guestId: string) => Promise<unknown | null>;
  save: (guestId: string, data: unknown) => Promise<void>;
  /** Saves per guest per hour; the client debounces to one per second of editing. */
  limiter?: RateLimiter;
  /** Saves per IP per hour, checked first (before a guest can be created). */
  ipLimiter?: RateLimiter;
  log?: (message: string, detail?: unknown) => void;
}

const NO_STORE = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

/** PUTs per guest per hour. */
export const PLAN_DATA_GUEST_LIMIT = 120;
/** PUTs per IP per hour, across guests. */
export const PLAN_DATA_IP_LIMIT = 600;
const defaultLimiter = new RateLimiter(PLAN_DATA_GUEST_LIMIT);
const defaultIpLimiter = new RateLimiter(PLAN_DATA_IP_LIMIT);
const TOO_MANY = "Too many saves. Try again later.";

/** GET: `{ data }` for this browser's guest; `{ data: null }` with no guest, no copy, or a malformed copy. */
export async function getPlanData(deps: PlanDataDeps): Promise<Response> {
  const log = deps.log ?? console.error;
  try {
    const guestId = await deps.getGuestId();
    if (!guestId) return json({ data: null });
    const stored = await deps.load(guestId);
    if (stored === null) return json({ data: null });
    const data = parsePlanData(stored);
    if (!data) log("GET /api/plan-data: stored copy is malformed, ignored");
    return json({ data });
  } catch (err) {
    log("GET /api/plan-data failed:", err instanceof Error ? err.message : err);
    return json({ data: null, error: "Saved copy is unavailable right now." }, 503);
  }
}

/**
 * PUT `{ profile, log, added }`: replace this guest's copy. Order: the per-IP limit, then the body (≤ 64 KB,
 * validated), then the guest. A cleared plan from a browser without a guest cookie has nothing to clear, so it
 * answers 200 without creating a guest. Then the per-guest limit, then the save.
 */
export async function putPlanData(request: Request, deps: PlanDataDeps): Promise<Response> {
  const log = deps.log ?? console.error;
  try {
    if (!(deps.ipLimiter ?? defaultIpLimiter).take(clientIp(request.headers))) throw new GuardError(429, TOO_MANY);
    const body = await readJsonBody(request, PLAN_DATA_MAX_BYTES);
    const data = parsePlanData({ profile: body.profile, log: body.log, added: body.added });
    if (!data) throw new GuardError(400, "Plan data is malformed.");
    let guestId: string;
    if (isClearedPlan(data)) {
      const existing = await deps.getGuestId();
      if (!existing) return json({ ok: true });
      guestId = existing;
    } else {
      guestId = await deps.getOrCreateGuestId();
    }
    if (!(deps.limiter ?? defaultLimiter).take(guestId)) throw new GuardError(429, TOO_MANY);
    await deps.save(guestId, data);
    return json({ ok: true });
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    log("PUT /api/plan-data failed:", err instanceof Error ? err.message : err);
    return json({ error: "Saving a copy is unavailable right now." }, 503);
  }
}
