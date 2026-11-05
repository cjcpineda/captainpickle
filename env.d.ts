// Secrets and optional settings. wrangler.jsonc doesn't list them, so `npm run cf-typegen` can't
// see them; they're declared here, merged into the generated CloudflareEnv in cloudflare-env.d.ts.
interface CloudflareEnv {
  AI_MODEL?: string;
  AI_VISION_MODEL?: string;
  CPL_DIVISION_ID?: string;
}
