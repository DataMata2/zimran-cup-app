import { explainHandler } from "@/lib/product/ai-handlers";
import { aiDeps } from "@/lib/product/ai-server";

/** POST /api/explain: the plan explained in plain English, streamed. See lib/product/ai-handlers. */
export const POST = explainHandler(aiDeps);
