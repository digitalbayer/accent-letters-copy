import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src", "icons", "icon.svg");
for (const size of [16, 32, 48, 96, 128]) {
  const output = path.join(root, "src", "icons", `icon-${size}.png`);
  await sharp(source).resize(size, size).png().toFile(output);
}
console.log("Created extension icons.");
