import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const sourceArgument = process.argv[2];
if (!sourceArgument) {
  throw new Error("Pass the path to the official UnicodeData.txt file");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.resolve(sourceArgument);
const outputPath = path.join(root, "vendor", "UnicodeData-Latin-17.0.0.txt");
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

function qualifies(row) {
  const codePoint = Number.parseInt(row[0], 16);
  const name = row[1];
  const category = row[2];
  if (!name.startsWith("LATIN ") || !["Lu", "Ll", "Lt"].includes(category)) return false;
  const decomposition = canonicalDecomposition(codePoint);
  if (decomposition.length < 2) return false;
  const base = decomposition[0];
  const isAsciiBase = (base >= 0x41 && base <= 0x5a) || (base >= 0x61 && base <= 0x7a);
  return isAsciiBase && decomposition.slice(1).every((part) => byCodePoint.get(part)?.[2]?.startsWith("M"));
}

const qualifyingRows = rows.filter(qualifies);
if (qualifyingRows.length !== 488) {
  throw new Error(`Expected 488 qualifying rows, found ${qualifyingRows.length}`);
}

const retained = new Set();
function retainTree(codePoint) {
  if (retained.has(codePoint)) return;
  retained.add(codePoint);
  const raw = byCodePoint.get(codePoint)?.[5] ?? "";
  if (!raw || raw.startsWith("<")) return;
  for (const part of raw.split(" ")) retainTree(Number.parseInt(part, 16));
}

for (const row of qualifyingRows) retainTree(Number.parseInt(row[0], 16));
const subset = rows.filter((row) => retained.has(Number.parseInt(row[0], 16)));
await writeFile(outputPath, `${subset.map((row) => row.join(";")).join("\n")}\n`, "utf8");
console.log(`Retained ${subset.length} UnicodeData rows supporting 488 qualifying characters.`);
