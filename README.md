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
npm run seed                      # loads match sheets from data/seed/
npm run captain -- you@example.com "CJ Pineda" "Pickleball Kingdom Tinton Falls" <password>
npm run dev                       # http://localhost:3000
```

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
| SQLite schema and queries | `lib/db.ts`, `lib/repo.ts` |
| Captain auth (scrypt passwords, session cookie) | `lib/auth.ts`, `lib/password.ts` |

The strategist runs on Google Gemini (`gemini-flash-latest` by default, which has a free tier; set `GEMINI_MODEL` to change it). Get a key at https://aistudio.google.com/apikey. The strategist answers only from what its tools return, so every score, pairing and date it quotes comes from the database.

## Data

- `data/seed/matches/` holds match sheets. The first is Pickleball Kingdom Tinton Falls vs Bounce Philly (8 rounds, 32 games). Genders come from the sheet's format: in even rounds, games 1–2 are women's doubles and games 3–4 are men's.
- `data/seed/fixtures.json` holds the schedule (currently @ Monroe, Thu Oct 29, 7:30 PM).

Run `npm run seed` after changing either; it's safe to re-run.

## Not built yet

- Practice-data upload (CSV, or a match-sheet PDF read by the AI)
- Pair ratings, win probabilities, and an eight-round lineup optimizer
- Weekly scouting email ("you're playing X this week; they usually pair…")
- Automatic sync from crossclubpickleball.com (schedule from `/leagues/lineups`, match sheets from `/leagues/matchup`, players from `/leagues/players`). Until then, schedule and match data come from `data/seed/`.
