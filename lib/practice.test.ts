import { test } from "node:test";
import assert from "node:assert/strict";
import { matchToRoster, readTemplateCsv } from "./practice.ts";

const roster = ["Chelsea Convissar", "CJ Pineda", "Joseph Mizrahi", "Sara Mizrahi", "Ethan Rosen"];

test("matches typed names to the roster", () => {
  assert.deepEqual(matchToRoster("chelsea", roster), { name: "Chelsea Convissar", known: true });
  assert.deepEqual(matchToRoster("Rosen", roster), { name: "Ethan Rosen", known: true });
  assert.deepEqual(matchToRoster("cj pineda", roster), { name: "CJ Pineda", known: true });
  // Two Mizrahis: ambiguous, so the name is kept as typed.
  assert.deepEqual(matchToRoster("Mizrahi", roster), { name: "Mizrahi", known: false });
  assert.deepEqual(matchToRoster("New Person", roster), { name: "New Person", known: false });
});

test("reads the CSV template, with or without dates", () => {
  const games = readTemplateCsv(
    "date,player_a1,player_a2,player_b1,player_b2,score_a,score_b\n" +
      "2026-10-20,Chelsea,CJ,Joseph,Ethan,11,7\n" +
      ",Chelsea,Joseph,CJ,Ethan,9,11\n",
  );
  assert.equal(games?.length, 2);
  assert.deepEqual(games?.[0], { playedOn: "2026-10-20", a: ["Chelsea", "CJ"], b: ["Joseph", "Ethan"], scoreA: 11, scoreB: 7 });
  assert.equal(games?.[1].playedOn, null);
});

test("hands other layouts to the AI and reports bad rows", () => {
  assert.equal(readTemplateCsv("Team 1,Team 2,Score\nChelsea/CJ,Joe/Ethan,11-7"), null);
  assert.throws(() => readTemplateCsv("player_a1,player_a2,player_b1,player_b2,score_a,score_b\nA,B,C,D,x,3"), /Line 2/);
});
