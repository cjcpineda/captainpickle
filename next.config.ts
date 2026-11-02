import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const config: NextConfig = {};

export default config;

// Lets `next dev` use the Cloudflare bindings (the local D1 database) from wrangler.jsonc.
initOpenNextCloudflareForDev();
