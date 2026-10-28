import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

/**
 * If a safety classifier declines a request, the API re-runs it on Anthropic's recommended
 * fallback model instead of returning the refusal.
 */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

const globalForClaude = globalThis as unknown as { claude?: Anthropic };

export function claude(): Anthropic {
  return (globalForClaude.claude ??= new Anthropic());
}
