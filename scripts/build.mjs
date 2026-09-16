import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(root, "build");
const distRoot = path.join(root, "dist");

await rm(buildRoot, { recursive: true, force: true });
await rm(distRoot, { recursive: true, force: true });
await mkdir(buildRoot, { recursive: true });
await mkdir(path.join(distRoot, "chrome"), { recursive: true });
await mkdir(path.join(distRoot, "firefox"), { recursive: true });

for (const browser of ["chrome", "firefox"]) {
  const destination = path.join(buildRoot, browser);
  await cp(path.join(root, "src"), destination, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(root, "manifests", `${browser}.json`), "utf8"));
  await writeFile(path.join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const archiveName = `accent-letters-copy-1.0.0.zip`;
  const archivePath = path.join(distRoot, browser, archiveName);
  const zipped = spawnSync("zip", ["-X", "-q", "-r", archivePath, "."], { cwd: destination, stdio: "inherit" });
  if (zipped.status !== 0) throw new Error(`Could not package ${browser}`);
}

console.log("Built Chrome and Firefox packages.");

