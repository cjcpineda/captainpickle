# League Captain

AI lineup strategist for **Cross Club Pickleball** captains. Captains sign in, see their team's schedule and results, and chat with an AI strategist that can read the league database.

**What's here:**
- **Schedule:** the next match (home/away, division, time, location) with its lineup deadline, upcoming matches, and past results with game-by-game lineups.
- **Scouting report:** for the next opponent, their roster with records, the pairs they use most, their strongest players, and a button that asks the AI for counter-pairings.
- **Practice:** upload practice games (any file; see below), check how they were read, then save. Shows your best pairs across league and practice.
- **AI Strategist:** a chat that reads all of the above from the database.

CPL lineup deadlines: away teams submit two nights before the match, home teams the night before, always at 7:30 PM Eastern (`lib/deadline.ts`).

## Quick start

Requires Node 22.13+ and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/cjcpineda/captainpickle.git
cd captainpickle
npm install
cp .dev.vars.example .env         # then set GEMINI_API_KEY
npm run db:migrate                # creates the local D1 database
npm run captain -- you@example.com "Your Name" "Your Team Name" <password>
npm run sync                      # pulls your schedule and results from CPL
npm run dev                       # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Day-to-day local development (uses `.env`) |
| `npm run preview` | Run locally inside the real Cloudflare Workers runtime (copy `.dev.vars.example` to `.dev.vars` first) |
| `npm run sync` | Pull the latest CPL data into the local database |
| `npm test` | Run the tests |

Locally, the CPL sync only runs when you call `npm run sync`. On Cloudflare it runs every six hours (cron in `wrangler.jsonc`).

## Deploy to Cloudflare

```bash
npx wrangler login
npm run db:migrate:remote
npx wrangler secret put GEMINI_API_KEY
npm run deploy
npm run captain -- you@example.com "Your Name" "Your Team Name" <password> --remote
```

First deploy on a new account: run `npx wrangler d1 create captainpickle` and paste the printed `database_id` into `wrangler.jsonc`. After changing bindings, run `npm run cf-typegen`.

## How it fits together

| Piece | Where |
| --- | --- |
| Schedule page (next match, deadline, upcoming, results) | `app/(app)/page.tsx` |
| Scouting report page | `app/(app)/scouting/page.tsx`, `lib/scouting.ts` |
| Practice uploads and best pairs | `app/(app)/practice/`, `components/PracticeUpload.tsx`, `lib/practice.ts` |
| AI Strategist chat UI | `components/Chat.tsx`, `components/Strategist.tsx` |
| Streaming chat endpoint (NDJSON) | `app/api/chat/route.ts` |
| Agent loop: Gemini plus tools, chats saved per captain | `lib/strategist/agent.ts` |
| Tools the AI can call (schedule, rosters, match sheets, scouting, player history) | `lib/strategist/tools.ts` |
| CPL sync (schedule, match sheets, players) | `lib/cpl.ts`, `lib/cpl-schedule.ts`, `custom-worker.ts` (cron) |
| D1 schema and queries | `migrations/`, `lib/db.ts`, `lib/repo.ts` |
| Captain auth (scrypt passwords, session cookie) | `lib/auth.ts`, `lib/password.ts` |

The strategist runs on Google Gemini (`gemini-flash-latest` by default, which has a free tier; set `GEMINI_MODEL` to change it). Get a key at https://aistudio.google.com/apikey. The strategist answers only from what its tools return, so every score, pairing and date it quotes comes from the database.

## Data from CPL

crossclubpickleball.com is a single-page app backed by a public, read-only JSON API. The sync (`lib/cpl.ts`) reads the same data the Lineups page shows:

- **Schedule:** every upcoming match for each captain's team, with date, time, home/away and address.
- **Match sheets:** every completed match involving your team or one of your upcoming opponents, game by game, with each player's gender.

A match is downloaded once and never re-fetched, so routine syncs make only a couple of requests. Forfeited games (no players listed) are skipped.

The division defaults to NJ / PA 4.0. Set `CPL_DIVISION_ID` for another division, or `CPL_SYNC=off` to turn off the automatic sync.

## Practice data

Captains upload practice games from the Practice page. Nothing is saved until they've checked the preview.

- **CSV template** (`public/practice-template.csv`): one row per game with `date, player_a1, player_a2, player_b1, player_b2, score_a, score_b`. Read directly, no AI. `date` may be blank; the captain picks one on upload.
- **Anything else:** another CSV layout, a text file, a PDF, or a photo of a scoresheet. Gemini reads the games out of it. For Excel, save as CSV first.

Typed names are matched to the roster: exact name, then a unique first name, last name or prefix ("Chelsea" → Chelsea Convissar). Names that match no one are flagged in the preview and added as new players. Practice games never count toward league results. The AI Strategist sees them, separately from league games.

## Not built yet

- Pair ratings, win probabilities, and an eight-round lineup optimizer
- Weekly scouting email ("you're playing X this week; they usually pair…")
