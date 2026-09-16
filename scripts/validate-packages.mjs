import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = [/^permissions$/, /^host_permissions$/, /^background$/, /^content_scripts$/, /^externally_connectable$/];
const remotePattern = /https?:\/\/(?!diacriticalmarks\.com)/i;

for (const browser of ["chrome", "firefox"]) {
  const build = path.join(root, "build", browser);
  const manifest = JSON.parse(await readFile(path.join(build, "manifest.json"), "utf8"));
  if (manifest.manifest_version !== 3) throw new Error(`${browser}: Manifest V3 required`);
  for (const key of forbidden) {
    if (Object.keys(manifest).some((candidate) => key.test(candidate))) throw new Error(`${browser}: forbidden manifest capability`);
  }
  if (browser === "chrome" && manifest.browser_specific_settings) throw new Error("Chrome package contains Firefox-only settings");
  if (browser === "firefox" && !manifest.browser_specific_settings?.gecko?.id) throw new Error("Firefox package has no stable ID");

  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else files.push(absolute);
    }
  }
  await walk(build);
  for (const file of files.filter((candidate) => /\.(?:html|css|js|json)$/.test(candidate))) {
    const contents = await readFile(file, "utf8");
    if (remotePattern.test(contents)) throw new Error(`${browser}: unexpected remote URL in ${path.relative(build, file)}`);
    if (/\beval\s*\(|new\s+Function\s*\(/.test(contents)) throw new Error(`${browser}: executable string API in ${path.relative(build, file)}`);
    if (/\.innerHTML\s*=|insertAdjacentHTML/.test(contents)) throw new Error(`${browser}: executable HTML insertion in ${path.relative(build, file)}`);
  }

  const archive = path.join(root, "dist", browser, "accent-letters-copy-1.0.0.zip");
  const archiveSize = (await stat(archive)).size;
  if (archiveSize <= 0 || archiveSize > 1_000_000) throw new Error(`${browser}: unexpected package size ${archiveSize}`);
  console.log(`${browser}: ${files.length} files, ${archiveSize} byte package, zero requested permissions.`);
}

