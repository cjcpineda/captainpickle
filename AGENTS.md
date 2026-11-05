<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
Add it to this environment. Open the cloud environment menu in the session’s title bar and choose Edit. Add these under Network secrets (labeled “API credentials” in older versions of the app), or as environment variables if that section isn’t there:
CLOUDFLARE_API_TOKEN: the token.
CLOUDFLARE_ACCOUNT_ID: your account ID, shown on the right side of the Workers & Pages overview page.