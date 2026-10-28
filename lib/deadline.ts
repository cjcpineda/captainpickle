/**
 * CPL lineup deadlines: away teams submit two nights before the match, home teams the night
 * before, always at 7:30 PM league time.
 */
const LEAGUE_TIME_ZONE = "America/New_York";
const DUE_TIME = "19:30";

export type Deadline = { date: string; time: string; passed: boolean };

export function lineupDeadline(playOn: string, isHome: boolean, now = new Date()): Deadline {
  const due = new Date(`${playOn}T12:00:00Z`);
  due.setUTCDate(due.getUTCDate() - (isHome ? 1 : 2));
  const date = due.toISOString().slice(0, 10);
  return { date, time: DUE_TIME, passed: `${date}T${DUE_TIME}` <= leagueNow(now) };
}

/** The current wall-clock time in the league's time zone, as YYYY-MM-DDTHH:MM. */
export function leagueNow(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: LEAGUE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Today's date in the league's time zone. */
export const leagueToday = (now = new Date()) => leagueNow(now).slice(0, 10);
