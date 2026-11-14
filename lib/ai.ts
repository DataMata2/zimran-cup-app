import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Claude model used across the app. */
export const MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;

/** Returns a shared Anthropic client; throws if ANTHROPIC_API_KEY is missing. */
export function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  client = new Anthropic({ apiKey });
  return client;
}
