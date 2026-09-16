import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "vendor", "UnicodeData-Latin-17.0.0.txt");
const outputPath = path.join(root, "src", "characters.js");
const checkOnly = process.argv.includes("--check");

const source = await readFile(sourcePath, "utf8");
const rows = source.trim().split(/\r?\n/).map((line) => line.split(";"));
const byCodePoint = new Map(rows.map((row) => [Number.parseInt(row[0], 16), row]));

function canonicalDecomposition(codePoint, visited = new Set()) {
  if (visited.has(codePoint)) return [codePoint];
  visited.add(codePoint);
  const row = byCodePoint.get(codePoint);
  const raw = row?.[5] ?? "";
  if (!raw || raw.startsWith("<")) return [codePoint];
  return raw
    .split(" ")
    .map((part) => Number.parseInt(part, 16))
    .flatMap((part) => canonicalDecomposition(part, new Set(visited)));
}

function codePointLabel(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

const records = [];
for (const row of rows) {
  const codePoint = Number.parseInt(row[0], 16);
  const name = row[1];
  const category = row[2];
  if (!name.startsWith("LATIN ")) continue;
  if (!["Lu", "Ll", "Lt"].includes(category)) continue;

  const decomposition = canonicalDecomposition(codePoint);
  if (decomposition.length < 2) continue;
  const baseCodePoint = decomposition[0];
  const isAsciiBase =
    (baseCodePoint >= 0x41 && baseCodePoint <= 0x5a) ||
    (baseCodePoint >= 0x61 && baseCodePoint <= 0x7a);
  if (!isAsciiBase) continue;
  if (!decomposition.slice(1).every((part) => byCodePoint.get(part)?.[2]?.startsWith("M"))) continue;

  const base = String.fromCodePoint(baseCodePoint);
  records.push({
    base: base.toUpperCase(),
    case: base === base.toLowerCase() ? "lowercase" : "uppercase",
    glyph: String.fromCodePoint(codePoint),
    name,
    codePoints: [codePointLabel(codePoint)],
    decomposition: decomposition.map(codePointLabel),
    sequence: false,
  });
}

records.push(
  {
    base: "Q",
    case: "uppercase",
    glyph: "Q\u0301",
    name: "LATIN CAPITAL LETTER Q WITH COMBINING ACUTE ACCENT",
    codePoints: ["U+0051", "U+0301"],
    decomposition: ["U+0051", "U+0301"],
    sequence: true,
  },
  {
    base: "Q",
    case: "lowercase",
    glyph: "q\u0301",
    name: "LATIN SMALL LETTER Q WITH COMBINING ACUTE ACCENT",
    codePoints: ["U+0071", "U+0301"],
    decomposition: ["U+0071", "U+0301"],
    sequence: true,
  },
);

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const groups = Object.fromEntries(letters.map((letter) => [letter, []]));
for (const record of records) groups[record.base].push(record);
for (const letter of letters) {
  groups[letter].sort((left, right) => {
    if (left.case !== right.case) return left.case === "lowercase" ? -1 : 1;
    return left.codePoints.join(" ").localeCompare(right.codePoints.join(" "));
  });
}

const precomposedCount = records.filter((record) => !record.sequence).length;
if (precomposedCount !== 488) throw new Error(`Expected 488 precomposed characters, found ${precomposedCount}`);
if (records.length !== 490) throw new Error(`Expected 490 total copy values, found ${records.length}`);
if (letters.some((letter) => groups[letter].length === 0)) throw new Error("Every A to Z group must contain a copy value");

const generated = `// Generated from UnicodeData 17.0.0. Do not edit by hand.\n` +
  `export const LETTERS = ${JSON.stringify(letters)};\n` +
  `export const CHARACTER_GROUPS = ${JSON.stringify(groups, null, 2)};\n` +
  `export const PRECOMPOSED_CHARACTERS = ${precomposedCount};\n` +
  `export const TOTAL_CHARACTERS = ${records.length};\n`;

if (checkOnly) {
  const current = await readFile(outputPath, "utf8");
  if (current !== generated) throw new Error("src/characters.js is not synchronized with UnicodeData 17.0.0");
  console.log(`Verified ${precomposedCount} precomposed characters and ${records.length - precomposedCount} Q sequences.`);
} else {
  await writeFile(outputPath, generated, "utf8");
  console.log(`Generated ${precomposedCount} precomposed characters and ${records.length - precomposedCount} Q sequences.`);
}
