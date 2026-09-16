import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CHARACTER_GROUPS, LETTERS, PRECOMPOSED_CHARACTERS, TOTAL_CHARACTERS } from "../src/characters.js";

const unicodeRows = (await readFile(new URL("../vendor/UnicodeData-Latin-17.0.0.txt", import.meta.url), "utf8"))
  .trim()
  .split(/\r?\n/)
  .map((line) => line.split(";"));
const unicodeNames = new Map(unicodeRows.map((row) => [`U+${row[0]}`, row[1]]));

test("inventory contains 488 precomposed characters and two disclosed Q sequences", () => {
  assert.equal(PRECOMPOSED_CHARACTERS, 488);
  assert.equal(TOTAL_CHARACTERS, 490);
  assert.deepEqual(LETTERS, "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
  assert.equal(CHARACTER_GROUPS.Q.length, 2);
  assert.deepEqual(CHARACTER_GROUPS.Q.map((record) => record.glyph), ["q\u0301", "Q\u0301"]);
});

test("every A to Z family is populated and glyphs are globally unique", () => {
  const records = Object.values(CHARACTER_GROUPS).flat();
  assert.equal(new Set(records.map((record) => record.glyph)).size, records.length);
  for (const letter of LETTERS) assert.ok(CHARACTER_GROUPS[letter].length > 0, `${letter} must be populated`);
});

test("precomposed names and code points match pinned Unicode 17 data", () => {
  for (const record of Object.values(CHARACTER_GROUPS).flat().filter((candidate) => !candidate.sequence)) {
    assert.equal(record.codePoints.length, 1);
    assert.equal(unicodeNames.get(record.codePoints[0]), record.name);
    assert.equal(String.fromCodePoint(Number.parseInt(record.codePoints[0].slice(2), 16)), record.glyph);
    assert.equal(record.base, record.decomposition[0] ? String.fromCodePoint(Number.parseInt(record.decomposition[0].slice(2), 16)).toUpperCase() : null);
  }
});

test("the compatibility Angstrom sign is excluded", () => {
  const glyphs = Object.values(CHARACTER_GROUPS).flat().map((record) => record.glyph);
  assert.ok(!glyphs.includes("Å"));
  assert.ok(glyphs.includes("Å"));
});
