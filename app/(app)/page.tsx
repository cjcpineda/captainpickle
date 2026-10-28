import Link from "next/link";
import { requireCaptain } from "@/lib/auth.ts";
import { lastSyncedAt } from "@/lib/cpl.ts";
import { clockTime, longDate, monthDay, timeAgo, weekday } from "@/lib/dates.ts";
import { leagueToday, lineupDeadline } from "@/lib/deadline.ts";
import { matchGames, results, upcomingFixtures, type Fixture, type Result } from "@/lib/repo.ts";

export default async function SchedulePage() {
  const captain = await requireCaptain();
  const upcoming = upcomingFixtures(captain.teamId, leagueToday());
  const played = results(captain.teamId);
  const [next] = upcoming;
  const synced = lastSyncedAt();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Cross Club Pickleball{next?.division && ` · ${next.division}`}</div>
          <h1>{captain.teamName}</h1>
        </div>
        <span className="sub">{synced ? `Synced from CPL ${timeAgo(synced)}` : "Waiting for first CPL sync"}</span>
      </div>

      {next && <NextMatch fixture={next} />}

      <div className="grid">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Upcoming</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="empty">Nothing scheduled on CPL.</p>
            ) : (
              <ul className="rows">
                {upcoming.map((f) => (
                  <li key={f.id} className="row">
                    <DateChip iso={f.playOn} />
                    <div>
                      <div className="opponent">
                        {f.isHome ? "vs" : "@"} {f.opponent}
                      </div>
                      <div className="sub">
                        {clockTime(f.startTime)}
                        {f.location && ` · ${f.location}`}
                      </div>
                    </div>
                    <span className={`badge ${f.isHome ? "home" : "away"}`}>{f.isHome ? "HOME" : "AWAY"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Results</h2>
              <span className="sub">Games won–lost</span>
            </div>
            {played.length === 0 ? (
              <p className="empty">No results yet.</p>
            ) : (
              <ul className="rows">
                {played.map((r) => (
                  <ResultRow key={r.matchId} result={r} teamId={captain.teamId} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="card">
          <div className="card-head">
            <h2>Lineup deadlines</h2>
          </div>
          <dl className="rules">
            <dt>Away match</dt>
            <dd>Two nights before, 7:30 PM</dd>
            <dt>Home match</dt>
            <dd>The night before, 7:30 PM</dd>
          </dl>
        </aside>
      </div>
    </>
  );
}

function NextMatch({ fixture }: { fixture: Fixture }) {
  const deadline = lineupDeadline(fixture.playOn, fixture.isHome);
  const ask = `We're ${fixture.isHome ? "hosting" : "playing at"} ${fixture.opponent} on ${longDate(fixture.playOn)}. Help me plan our lineup.`;
  return (
    <section className="next-match">
      <div>
        <div className="kicker">Next match · {fixture.isHome ? "Home" : "Away"}</div>
        <div className="vs">
          <small>{fixture.isHome ? "vs" : "@"}</small>
          {fixture.opponent}
        </div>
        <div className="when">
          {longDate(fixture.playOn)} · {clockTime(fixture.startTime)}
          {fixture.location && ` · ${fixture.location}`}
        </div>
        <div className={`deadline ${deadline.passed ? "passed" : ""}`}>
          {deadline.passed ? "Lineup locked" : "Lineup due"} {weekday(deadline.date)}, {monthDay(deadline.date)} ·{" "}
          {clockTime(deadline.time)}
        </div>
      </div>
      <div className="actions">
        <Link className="button" href={`/scouting?team=${fixture.opponentId}`}>
          Scouting report
        </Link>
        <Link className="button ghost" href={`/strategist?q=${encodeURIComponent(ask)}`}>
          Plan lineup
        </Link>
      </div>
    </section>
  );
}

function DateChip({ iso }: { iso: string }) {
  return (
    <div className="date-chip">
      <span>{weekday(iso)}</span>
      <b>{monthDay(iso)}</b>
    </div>
  );
}

function ResultRow({ result, teamId }: { result: Result; teamId: number }) {
  const outcome = result.gamesWon > result.gamesLost ? "w" : result.gamesWon < result.gamesLost ? "l" : "t";
  const games = matchGames(result.matchId, teamId);
  return (
    <li>
      <details className="result-row">
        <summary className="row">
          <DateChip iso={result.playedOn} />
          <div>
            <div className="opponent">
              {result.isHome ? "vs" : "@"} {result.opponent}
            </div>
            <div className="sub">
              {games.length} games<span className="tap-hint"> · tap for lineups</span>
            </div>
          </div>
          <div className="result">
            <span className={`badge ${outcome}`}>{outcome.toUpperCase()}</span>
            {result.gamesWon}–{result.gamesLost}
          </div>
        </summary>
        <ol className="rows games">
          {games.map((g, i) => (
            <li key={i} className="row">
              <span className="sub">Round {g.round ?? "–"}</span>
              <span>
                <b>{g.home.join(" & ")}</b> <span className="sub">vs</span> {g.away.join(" & ")}
              </span>
              <span className={`result game-score ${g.homeScore > g.awayScore ? "won" : "lost"}`}>
                {g.homeScore}–{g.awayScore}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}
