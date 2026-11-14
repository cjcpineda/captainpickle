import { requireCaptain } from "@/lib/auth.ts";
import { monthDay, weekday } from "@/lib/dates.ts";
import { practiceSessions } from "@/lib/repo.ts";
import { cplPlayerRecords, type CplPlayerRecord } from "@/lib/cpl.ts";
import { pairRecords, type PairRecord, type WinLoss } from "@/lib/scouting.ts";
import { PracticeUpload } from "@/components/PracticeUpload.tsx";
import { deletePractice } from "./actions.ts";

const FORMAT_LABEL = { mixed: "Mixed", womens: "Women's", mens: "Men's" } as const;

export default async function PracticePage() {
  const captain = await requireCaptain();
  const [sessions, records, playerStats] = await Promise.all([
    practiceSessions(captain.teamId),
    pairRecords(captain.teamId),
    cplPlayerRecords(captain.teamId),
  ]);
  const pairs = alphabeticalPairs(records);
  const players = rankPlayers(playerStats);

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
              <h2>Pair records</h2>
              <span className="sub">Every pair, league + practice, A–Z</span>
            </div>
            {pairs.length === 0 ? (
              <p className="empty">No pairs yet.</p>
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

          <section className="card">
            <div className="card-head">
              <h2>Player records</h2>
              <span className="sub">CPL league games, best first</span>
            </div>
            {players.length === 0 ? (
              <p className="empty">No records yet. Sync from CPL on the Schedule page to load them.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>W–L</th>
                    <th>Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.name}>
                      <td className="num">{i + 1}</td>
                      <td>
                        <b>{p.name}</b> {p.gender && <span className="sub">{p.gender}</span>}
                      </td>
                      <td>
                        {p.wins}–{p.losses}
                      </td>
                      <td className="num">{winPct(p)}</td>
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

/** Every pair, names A–Z within each pair, then pairs A–Z. */
function alphabeticalPairs(pairs: PairRecord[]): PairRecord[] {
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  return pairs
    .map((p) => ({ ...p, players: [...p.players].sort(byName) as [string, string] }))
    .sort((x, y) => byName(x.players[0], y.players[0]) || byName(x.players[1], y.players[1]));
}

/** Highest win percentage first; ties go to whoever has more wins. Players with no games go last. */
function rankPlayers(players: CplPlayerRecord[]): CplPlayerRecord[] {
  const rate = (p: CplPlayerRecord) => (p.wins + p.losses === 0 ? -1 : p.wins / (p.wins + p.losses));
  return [...players].sort((a, b) => rate(b) - rate(a) || b.wins - a.wins || a.name.localeCompare(b.name));
}

function winPct({ wins, losses }: CplPlayerRecord): string {
  return wins + losses === 0 ? "–" : `${Math.round((100 * wins) / (wins + losses))}%`;
}

function record({ games, wins }: WinLoss): string {
  return games === 0 ? "–" : `${wins}–${games - wins}`;
}
