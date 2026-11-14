import { askHandler } from "@/lib/product/ai-handlers";
import { aiDeps } from "@/lib/product/ai-server";

/** POST /api/ask (Pro): questions about the plan, streamed. See lib/product/ai-handlers. */
export const POST = askHandler(aiDeps);
