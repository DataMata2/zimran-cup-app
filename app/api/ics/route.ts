import type { NextRequest } from "next/server";
import { estimate, TaxInputError, toICS } from "@/lib/tax";
import { decodeIcsParam } from "@/lib/product/icsParam";

const bad = (message: string) =>
  new Response(`${message}\n`, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * GET /api/ics?d=<base64url JSON TaxInput>: the remaining 2026 federal estimated-tax deadlines (and the
 * April return) as a calendar file. 400 when `d` is missing, malformed, or rejected by the engine.
 */
export function GET(request: NextRequest) {
  const input = decodeIcsParam(request.nextUrl.searchParams.get("d"));
  if (!input) return bad("Missing or malformed parameter d (base64url-encoded JSON tax input).");

  let ics: string;
  try {
    ics = toICS(estimate(input), { includeReturnDue: true });
  } catch (err) {
    if (err instanceof TaxInputError) return bad(`Invalid tax input: ${err.message}`);
    console.error("GET /api/ics failed:", err instanceof Error ? err.message : err);
    return new Response("Could not build the calendar.\n", { status: 500 });
  }

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="penaltyproof-2026.ics"',
      "cache-control": "no-store",
    },
  });
}
