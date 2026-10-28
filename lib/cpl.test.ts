import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveReferences } from "./cpl.ts";

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
