import { readPaymentHandler } from "@/lib/product/ai-handlers";
import { aiDeps } from "@/lib/product/ai-server";

/** POST /api/read-payment: amount, payer and date from a pasted payout or a screenshot (Pro). See lib/product/ai-handlers. */
export const POST = readPaymentHandler(aiDeps);
