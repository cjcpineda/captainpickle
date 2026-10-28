import Link from "next/link";
import { requireCaptain } from "@/lib/auth.ts";
import { longDate, monthDay, todayIso, weekday } from "@/lib/dates.ts";
import { matchGames, results, upcomingFixtures, type Result } from "@/lib/repo.ts";
import { removeMatch } from "../actions.ts";
import { AddFixtureForm } from "@/components/AddFixtureForm.tsx";

export default async function SchedulePage() {
  const captain = await requireCaptain();
  const upcoming = upcomingFixtures(captain.teamId, todayIso());
  const played = results(captain.teamId);
  const [next] = upcoming;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Cross Club Pickleball</div>
          <h1>{captain.teamName}</h1>
        </div>
      </div>

      {next && (
        <section className="next-match">
          <div>
            <div className="kicker">Next match</div>
            <div className="vs">
              <small>vs</small>
              {next.opponent}
            </div>
            <div className="when">
              {longDate(next.playOn)}
              {next.location && ` · ${next.location}`}
            </div>
          </div>
          <Link
            className="button"
            href={`/strategist?q=${encodeURIComponent(`We're playing ${next.opponent} on ${longDate(next.playOn)}. Help me plan our lineup.`)}`}
          >
            Plan lineup
          </Link>
        </section>
      )}

      <div className="grid">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Upcoming</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="empty">Nothing scheduled yet. Add your next match.</p>
            ) : (
              <ul className="rows">
                {upcoming.map((f) => (
                  <li key={f.id} className="row">
                    <DateChip iso={f.playOn} />
                    <div>
                      <div className="opponent">vs {f.opponent}</div>
                      {f.location && <div className="sub">{f.location}</div>}
                    </div>
                    <form action={removeMatch.bind(null, f.id)}>
                      <button className="icon-button" aria-label={`Remove match vs ${f.opponent}`}>×</button>
                    </form>
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
            <h2>Add a match</h2>
          </div>
          <div className="card-body">
            <AddFixtureForm />
          </div>
        </aside>
      </div>
    </>
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
            <div className="opponent">vs {result.opponent}</div>
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
