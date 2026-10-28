# Captain Pickle

AI lineup strategist for **Cross Club Pickleball** captains. Captains sign in, see their team's schedule and results, and chat with an AI strategist that can read the league database.

**What's here:**
- **Schedule:** the next match (home/away, division, time, location) with its lineup deadline, upcoming matches, and past results with game-by-game lineups.
- **Scouting report:** for the next opponent, their roster with records, the pairs they use most, their strongest players, and a button that asks the AI for counter-pairings.
- **AI Strategist:** a chat that reads all of the above from the database.

CPL lineup deadlines: away teams submit two nights before the match, home teams the night before, always at 7:30 PM Eastern (`lib/deadline.ts`).

## Quick start

```bash
npm install
cp .env.example .env.local        # then set GEMINI_API_KEY
npm run captain -- you@example.com "CJ Pineda" "Pickleball Kingdom Tinton Falls" <password>
npm run dev                       # http://localhost:3000
```

The server pulls your schedule and match history from CPL when it starts, then every six hours. Run `npm run sync` to pull right away.

Requires Node 22.13+. It uses the built-in `node:sqlite`, so there's no native database driver to install.

## How it fits together

| Piece | Where |
| --- | --- |
| Schedule page (next match, deadline, upcoming, results) | `app/(app)/page.tsx` |
| Scouting report page | `app/(app)/scouting/page.tsx`, `lib/scouting.ts` |
| AI Strategist chat UI | `components/Chat.tsx`, `components/Strategist.tsx` |
| Streaming chat endpoint (NDJSON) | `app/api/chat/route.ts` |
| Agent loop: Gemini plus tools, chats saved per captain | `lib/strategist/agent.ts` |
| Tools the AI can call (schedule, rosters, match sheets, scouting, player history) | `lib/strategist/tools.ts` |
| CPL sync (schedule, match sheets, players) | `lib/cpl.ts`, `lib/cpl-schedule.ts`, `instrumentation.ts` |
| SQLite schema and queries | `lib/db.ts`, `lib/repo.ts` |
| Captain auth (scrypt passwords, session cookie) | `lib/auth.ts`, `lib/password.ts` |

The strategist runs on Google Gemini (`gemini-flash-latest` by default, which has a free tier; set `GEMINI_MODEL` to change it). Get a key at https://aistudio.google.com/apikey. The strategist answers only from what its tools return, so every score, pairing and date it quotes comes from the database.

## Data from CPL

crossclubpickleball.com is a single-page app backed by a public, read-only JSON API. The sync (`lib/cpl.ts`) reads the same data the Lineups page shows:

- **Schedule:** every upcoming match for each captain's team, with date, time, home/away and address.
- **Match sheets:** every completed match involving your team or one of your upcoming opponents, game by game, with each player's gender.

A match is downloaded once and never re-fetched, so routine syncs make only a couple of requests. Forfeited games (no players listed) are skipped.

The division defaults to NJ / PA 4.0. Set `CPL_DIVISION_ID` for another division, or `CPL_SYNC=off` to turn off the automatic sync.

## Not built yet

- Practice-data upload (CSV, or a match-sheet PDF read by the AI)
- Pair ratings, win probabilities, and an eight-round lineup optimizer
- Weekly scouting email ("you're playing X this week; they usually pair…")
