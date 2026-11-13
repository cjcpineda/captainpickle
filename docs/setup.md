# Captain Pickle

AI lineup strategist for Cross Club Pickleball captains.

## Setup

**Requires:** Node 22.13+ and a Cloudflare account (the AI runs on Workers AI; no API key)

```bash
git clone https://github.com/cjcpineda/captainpickle.git
cd captainpickle
npm install
cp .dev.vars.example .env
```

Log in to Cloudflare once. Workers AI always runs on Cloudflare, even when the rest of the app runs on your computer:

```bash
npx wrangler login
```

Create the local database:

```bash
npm run db:migrate
```

Create a captain login:

```bash
npm run captain -- you@example.com "Your Name" "Your Team Name" yourpassword --division "NJ / PA 4.0"
```

Use your team's division as crossclubpickleball.com names it (`"NJ / PA 3.0"`, `"NJ / PA 3.5 (50+)"`, …). Each captain sees only their own division's schedule, players and results.

Start the app:

```bash
npm run dev
```

Go to http://localhost:3000 and sign in.

## Other commands

| Command | What it does |
| --- | --- |
| `npm run sync` | Pull the latest CPL schedule and results into the local database now |
| `npm run preview` | Run the app locally inside the Cloudflare Workers runtime |
| `npm test` | Run the tests |
## Deploy to Cloudflare

The app runs on Cloudflare Workers, with its data in D1 (Cloudflare's SQLite). The CPL sync runs every 6 hours as a Cron Trigger.

```bash
npx wrangler login
npx wrangler d1 create captainpickle      # paste the printed database_id into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
npm run captain -- you@example.com "Your Name" "Your Team Name" yourpassword --division "NJ / PA 4.0" --remote
```

After changing bindings in `wrangler.jsonc`, run `npm run cf-typegen` to refresh `cloudflare-env.d.ts`.
