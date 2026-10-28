# Captain Pickle

AI lineup strategist for **Cross Club Pickleball** captains. Captains sign in, see their team's schedule and results, and chat with an AI strategist that can read the league database.

**MVP scope:** captain login, the team's schedule (upcoming matches plus past results with game-by-game lineups), and the AI Strategist chat.

## Quick start

```bash
npm install
cp .env.example .env.local        # then set ANTHROPIC_API_KEY
npm run seed                      # loads match sheets from data/seed/
npm run captain -- you@example.com "CJ Pineda" "Pickleball Kingdom Tinton Falls" <password>
npm run dev                       # http://localhost:3000
```

Requires Node 22.13+. It uses the built-in `node:sqlite`, so there's no native database driver to install.

## How it fits together

| Piece | Where |
| --- | --- |
| Schedule page (next match, upcoming, results, add a match) | `app/(app)/page.tsx` |
| AI Strategist chat UI | `components/Chat.tsx`, `components/Strategist.tsx` |
| Streaming chat endpoint (NDJSON) | `app/api/chat/route.ts` |
| Agent loop: Claude plus tools, chats saved per captain | `lib/strategist/agent.ts` |
| Tools the AI can call (schedule, rosters, match sheets, player history) | `lib/strategist/tools.ts` |
| SQLite schema and queries | `lib/db.ts`, `lib/repo.ts` |
| Captain auth (scrypt passwords, session cookie) | `lib/auth.ts`, `lib/password.ts` |

The strategist runs on `claude-opus-5-5`. It answers only from what its tools return, so every score, pairing and date it quotes comes from the database. If a request is declined by a safety classifier, the server-side fallback re-runs it on Anthropic's recommended model.

## Data

`data/seed/cross-club-2026-10-26.json` is the Pickleball Kingdom Tinton Falls vs Bounce Philly match sheet (8 rounds, 32 games). Genders come from the sheet's format: in even rounds, games 1–2 are women's doubles and games 3–4 are men's. To add another match sheet, drop a JSON file in the same shape into `data/seed/` and run `npm run seed` again.

Captains add upcoming matches from the Schedule page.

## Not built yet

- Practice-data upload (CSV, or match-sheet PDF read by Claude)
- Pair ratings, win probabilities, and an eight-round lineup optimizer
- Weekly scouting email ("you're playing X this week; they usually pair…")
- Sync from crossclubpickleball.com (`/leagues/lineups`, `/leagues/players`)
