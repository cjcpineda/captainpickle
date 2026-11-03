import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const config: NextConfig = {};

export default config;

// Lets `next dev` use the Cloudflare bindings from wrangler.jsonc: the local D1 database, and Workers AI,
// which always runs on Cloudflare (run `npx wrangler login` once). Skipped during `next build`, where the
// remote AI binding would make the build server try to log in to Cloudflare and fail.
if (process.env.NODE_ENV === "development") initOpenNextCloudflareForDev();
