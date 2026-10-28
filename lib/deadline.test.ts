import { test } from "node:test";
import assert from "node:assert/strict";
import { leagueNow, lineupDeadline } from "./deadline.ts";

test("away teams submit two nights before, home teams the night before", () => {
  assert.equal(lineupDeadline("2026-10-29", false).date, "2026-10-27");
  assert.equal(lineupDeadline("2026-10-29", true).date, "2026-10-28");
  assert.equal(lineupDeadline("2026-11-01", false).date, "2026-10-30");
});

test("the deadline passes at 7:30 PM Eastern", () => {
  // 7:29 PM and 7:30 PM EDT on Tuesday, Oct 27 2026 (UTC-4).
  assert.equal(lineupDeadline("2026-10-29", false, new Date("2026-10-27T23:29:00Z")).passed, false);
  assert.equal(lineupDeadline("2026-10-29", false, new Date("2026-10-27T23:30:00Z")).passed, true);
});

test("league time follows Eastern time", () => {
  assert.equal(leagueNow(new Date("2026-12-01T03:00:00Z")), "2026-11-30T22:00");
});
