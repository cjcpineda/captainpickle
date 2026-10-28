import { requireCaptain } from "@/lib/auth.ts";
import { monthDay, weekday } from "@/lib/dates.ts";
import { practiceSessions } from "@/lib/repo.ts";
import { pairRecords, type PairRecord, type WinLoss } from "@/lib/scouting.ts";
import { PracticeUpload } from "@/components/PracticeUpload.tsx";
import { deletePractice } from "./actions.ts";

const FORMAT_LABEL = { mixed: "Mixed", womens: "Women's", mens: "Men's" } as const;
const MIN_GAMES = 2;

export default async function PracticePage() {
  const captain = await requireCaptain();
  const sessions = practiceSessions(captain.teamId);
  const pairs = bestPairs(pairRecords(captain.teamId));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Practice data</div>
          <h1>Practice</h1>
          <div className="sub">Upload practice games so the AI Strategist can weigh them alongside league results.</div>
        </div>
      </div>

      <div className="grid">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Upload</h2>
            </div>
            <div className="card-body">
              <PracticeUpload />
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Best pairs</h2>
              <span className="sub">League + practice, {MIN_GAMES}+ games, best first</span>
            </div>
            {pairs.length === 0 ? (
              <p className="empty">No pairs with {MIN_GAMES}+ games yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>League</th>
                    <th>Practice</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p) => (
                    <tr key={p.players.join()}>
                      <td>
                        <span className="tag">{p.format ? FORMAT_LABEL[p.format] : "?"}</span>
                        <br />
                        <b>{p.players.join(" & ")}</b>
                      </td>
                      <td>{record(p.league)}</td>
                      <td>{record(p.practice)}</td>
                      <td className="num">{record(total(p))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="card">
          <div className="card-head">
            <h2>Sessions</h2>
          </div>
          {sessions.length === 0 ? (
            <p className="empty">No practice uploaded yet.</p>
          ) : (
            <ul className="rows">
              {sessions.map((s) => (
                <li key={s.matchId} className="row session-row">
                  <div className="date-chip">
                    <span>{weekday(s.playedOn)}</span>
                    <b>{monthDay(s.playedOn)}</b>
                  </div>
                  <div>
                    <div className="opponent">{s.games} games</div>
                    <div className="sub">{s.source.replace(/^Practice upload: /, "")}</div>
                  </div>
                  <form action={deletePractice.bind(null, s.matchId)}>
                    <button className="icon-button" aria-label={`Delete practice from ${monthDay(s.playedOn)}`}>
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}

function total(p: PairRecord): WinLoss {
  return {
    games: p.league.games + p.practice.games,
    wins: p.league.wins + p.practice.wins,
    pointDiff: p.league.pointDiff + p.practice.pointDiff,
  };
}

function bestPairs(pairs: PairRecord[]): PairRecord[] {
  return pairs
    .filter((p) => total(p).games >= MIN_GAMES)
    .sort((x, y) => smoothedWinRate(total(y)) - smoothedWinRate(total(x)))
    .slice(0, 15);
}

/** Win rate pulled toward 50% for small samples, so 2–0 doesn't outrank 12–2. */
function smoothedWinRate({ wins, games }: WinLoss): number {
  return (wins + 1) / (games + 2);
}

function record({ games, wins }: WinLoss): string {
  return games === 0 ? "–" : `${wins}–${games - wins}`;
}
