// Bindings and secrets available to the Worker. Regenerate with `npm run cf-typegen` after changing wrangler.jsonc.
interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  WORKER_SELF_REFERENCE: Fetcher;
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  CPL_DIVISION_ID?: string;
}
