import Link from "next/link";
import { requireCaptain } from "@/lib/auth.ts";
import { leagueToday } from "@/lib/deadline.ts";
import { longDate } from "@/lib/dates.ts";
import { upcomingFixtures } from "@/lib/repo.ts";
import { scoutingReport, type Format, type ScoutingReport, type ScoutedPair, type ScoutedPlayer } from "@/lib/scouting.ts";

const FORMAT_LABEL: Record<Format, string> = { mixed: "Mixed", womens: "Women's", mens: "Men's" };

export default async function ScoutingPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const [captain, { team }] = await Promise.all([requireCaptain(), searchParams]);
  const fixtures = upcomingFixtures(captain.teamId, leagueToday());
  const fixture = team ? fixtures.find((f) => f.opponentId === Number(team)) : fixtures[0];
  const opponentId = fixture?.opponentId ?? (team ? Number(team) : null);

  if (!opponentId) {
    return <p className="empty card">No upcoming opponent to scout.</p>;
  }

  const report = scoutingReport(opponentId);
  const ask = `Give me recommended counter-pairings for all eight rounds against ${report.team}, based on their likely pairs and strongest players.`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Scouting report{fixture && ` · ${longDate(fixture.playOn)}`}</div>
          <h1>{report.team}</h1>
          <div className="sub">
            {report.gamesOnFile} game{report.gamesOnFile === 1 ? "" : "s"} on file · {report.roster.length} players
          </div>
        </div>
        <Link className="button" href={`/strategist?q=${encodeURIComponent(ask)}`}>
          Get counter-pairings
        </Link>
      </div>

      {report.gamesOnFile === 0 ? (
        <p className="notice">
          We don&apos;t have any {report.team} games on file yet. Their roster, likely pairs and strongest players will
          fill in once their CPL match history is synced.
        </p>
      ) : (
        <Report report={report} />
      )}
    </>
  );
}

function Report({ report }: { report: ScoutingReport }) {
  return (
    <div className="scouting">
      <section className="card">
        <div className="card-head">
          <h2>Strongest players</h2>
          <span className="sub">Win rate, 2+ games</span>
        </div>
        {report.strongest.length === 0 ? (
          <p className="empty">Not enough games yet.</p>
        ) : (
          <ol className="rows">
            {report.strongest.map((p, i) => (
              <li key={p.name} className="row stat-row">
                <span className="rank">{i + 1}</span>
                <PlayerName player={p} />
                <Record wins={p.wins} games={p.games} pointDiff={p.pointDiff} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Likely pairs</h2>
          <span className="sub">Most frequent first</span>
        </div>
        {report.likelyPairs.length === 0 ? (
          <p className="empty">No pairings on file.</p>
        ) : (
          <ul className="rows">
            {report.likelyPairs.slice(0, 10).map((pair) => (
              <PairRow key={pair.players.join()} pair={pair} />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Roster</h2>
        </div>
        {report.roster.length === 0 ? (
          <p className="empty">No players on file.</p>
        ) : (
          <ul className="rows">
            {report.roster.map((p) => (
              <li key={p.name} className="row stat-row">
                <span className="rank">{p.gender ?? "–"}</span>
                <span>{p.name}</span>
                <Record wins={p.wins} games={p.games} pointDiff={p.pointDiff} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlayerName({ player }: { player: ScoutedPlayer }) {
  return (
    <span>
      <b>{player.name}</b> {player.gender && <span className="sub">{player.gender}</span>}
    </span>
  );
}

function PairRow({ pair }: { pair: ScoutedPair }) {
  return (
    <li className="row stat-row">
      <span className="tag">{pair.format ? FORMAT_LABEL[pair.format] : "?"}</span>
      <b>{pair.players.join(" & ")}</b>
      <Record wins={pair.wins} games={pair.games} pointDiff={pair.pointDiff} />
    </li>
  );
}

function Record({ wins, games, pointDiff }: { wins: number; games: number; pointDiff: number }) {
  if (games === 0) return <span className="sub">No games</span>;
  return (
    <span className="record">
      {wins}–{games - wins}
      <span className="sub">{pointDiff > 0 ? `+${pointDiff}` : pointDiff} pts</span>
    </span>
  );
}
