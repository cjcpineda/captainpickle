import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "./csv.ts";

test("parses quoted fields, escaped quotes and CRLF, skipping blank lines", () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""e"""\r\n\r\n1,2,3\r\n'), [
    ["a", "b, c", 'd "e"'],
    ["1", "2", "3"],
  ]);
});
