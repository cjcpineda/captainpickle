import { test } from "node:test";
import assert from "node:assert/strict";
import { opponentStrength, resolveReferences } from "./cpl.ts";

test("unwraps $values arrays and follows $ref links", () => {
  const raw = {
    $id: "1",
    $values: [
      { $id: "2", teamName: "Monroe", club: { $id: "3", name: "The Club at Monroe" } },
      { $id: "4", teamName: "Monroe B", club: { $ref: "3" } },
    ],
  };
  const [a, b] = resolveReferences(raw) as { teamName: string; club: { name: string } }[];
  assert.equal(a.teamName, "Monroe");
  assert.equal(b.club.name, "The Club at Monroe");
  assert.equal(b.club, a.club);
  assert.ok(!("$id" in a));
});

test("rates each player by the season win % of the opponents they faced", () => {
  const records = [
    { name: "Strong One", team: "Bounce", gender: null, wins: 9, losses: 1 },
    { name: "Strong Two", team: "Bounce", gender: null, wins: 7, losses: 3 },
    { name: "Weak One", team: "Kingdom", gender: null, wins: 2, losses: 8 },
    { name: "Weak Two", team: "Kingdom", gender: null, wins: 0, losses: 10 },
  ];
  const faced = [
    { player: "Mike Alfaro", opponent: "Strong One", opponentTeam: "Bounce" },
    { player: "Mike Alfaro", opponent: "Strong Two", opponentTeam: "Bounce" },
    { player: "Vanessa", opponent: "Weak One", opponentTeam: "Kingdom" },
    { player: "Vanessa", opponent: "Weak Two", opponentTeam: "Kingdom" },
    { player: "Vanessa", opponent: "Unknown", opponentTeam: "Kingdom" }, // no record: skipped
  ];
  const strength = opponentStrength(faced, records);
  assert.equal(strength.get("mike alfaro"), 0.8);
  assert.equal(strength.get("vanessa"), 0.1);
});
