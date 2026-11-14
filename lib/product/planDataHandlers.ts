// GET / PUT /api/plan-data: the server copy of the guest's plan. Dependencies are passed in, so the handlers
// are unit-tested without Next or Supabase; app/api/plan-data/route.ts wires the real ones.

import { GuardError, guardResponse, RateLimiter, readJsonBody } from "./ai-guard";
import { parsePlanData, PLAN_DATA_MAX_BYTES } from "./planData";

export interface PlanDataDeps {
  /** The guest id from the cookie, or null (GET never creates a guest). */
  getGuestId: () => Promise<string | null>;
  /** The guest id, creating the cookie and the guest row if needed (PUT). */
  getOrCreateGuestId: () => Promise<string>;
  load: (guestId: string) => Promise<unknown | null>;
  save: (guestId: string, data: unknown) => Promise<void>;
  /** Saves per guest per hour; the client debounces to one per second of editing. */
  limiter?: RateLimiter;
  log?: (message: string, detail?: unknown) => void;
}

const NO_STORE = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

const defaultLimiter = new RateLimiter(600);

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

/** PUT `{ profile, log, added }`: replace this guest's copy. Body ≤ 64 KB and validated before saving. */
export async function putPlanData(request: Request, deps: PlanDataDeps): Promise<Response> {
  const log = deps.log ?? console.error;
  try {
    const body = await readJsonBody(request, PLAN_DATA_MAX_BYTES);
    const data = parsePlanData({ profile: body.profile, log: body.log, added: body.added });
    if (!data) throw new GuardError(400, "Plan data is malformed.");
    const guestId = await deps.getOrCreateGuestId();
    if (!(deps.limiter ?? defaultLimiter).take(guestId)) throw new GuardError(429, "Too many saves. Try again later.");
    await deps.save(guestId, data);
    return json({ ok: true });
  } catch (err) {
    if (err instanceof GuardError) return guardResponse(err);
    log("PUT /api/plan-data failed:", err instanceof Error ? err.message : err);
    return json({ error: "Saving a copy is unavailable right now." }, 503);
  }
}
