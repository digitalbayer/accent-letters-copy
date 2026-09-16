import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "store", "assets");
await mkdir(output, { recursive: true });

const server = spawn(process.execPath, ["tests/server.mjs"], {
  cwd: root,
  stdio: ["ignore", "pipe", "inherit"],
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4173/");
      if (response.ok) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Popup asset server did not start");
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? ["--no-sandbox"] : [],
  });
  const popup = await browser.newPage({ viewport: { width: 420, height: 560 }, deviceScaleFactor: 1 });
  await popup.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await popup.screenshot({ path: path.join(output, "popup-420x560.png") });

  const popupImage = (await readFile(path.join(output, "popup-420x560.png"))).toString("base64");
  const iconImage = (await readFile(path.join(root, "src", "icons", "icon-128.png"))).toString("base64");

  const listing = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await listing.setContent(`<!doctype html>
    <html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{margin:0;width:1280px;height:800px;overflow:hidden}
      body{display:grid;grid-template-columns:1fr 520px;align-items:center;gap:72px;padding:70px 92px;background:#f8f7f1;color:#17382f;font-family:Arial,Helvetica,sans-serif}
      .brand{display:flex;align-items:center;gap:18px;margin-bottom:42px;color:#b27624;font-size:18px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
      .brand img{width:72px;height:72px;border-radius:14px}
      h1{max-width:600px;margin:0;font-family:Georgia,serif;font-size:68px;line-height:1.02;letter-spacing:-.025em}
      p{max-width:560px;margin:26px 0 0;color:#586a63;font-size:27px;line-height:1.4}
      ul{display:grid;gap:14px;margin:34px 0 0;padding:0;list-style:none;font-size:20px;font-weight:700}
      li::before{content:"✓";margin-right:12px;color:#1d654f}
      .frame{justify-self:end;width:472px;padding:22px 26px 0;border:1px solid #bac8c1;border-radius:28px;background:#fff;box-shadow:0 24px 64px #17382f26}
      .frame img{display:block;width:420px;height:560px;object-fit:cover;object-position:top;border:1px solid #bac8c1;border-bottom:0;border-radius:14px 14px 0 0}
    </style></head><body>
      <section><div class="brand"><img src="data:image/png;base64,${iconImage}" alt="">Diacritical Marks</div>
      <h1>Every accent letter, one click away.</h1>
      <p>Choose an A to Z base letter and copy the exact character you need.</p>
      <ul><li>490 exact copy values</li><li>Private and available offline</li><li>Chrome and Firefox</li></ul></section>
      <div class="frame"><img src="data:image/png;base64,${popupImage}" alt="Accent Letters extension popup"></div>
    </body></html>`, { waitUntil: "load" });
  await listing.screenshot({ path: path.join(output, "chrome-screenshot-1280x800.png") });

  const promo = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  await promo.setContent(`<!doctype html>
    <html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{margin:0;width:440px;height:280px;overflow:hidden}
      body{display:flex;align-items:center;gap:26px;padding:34px;background:#17382f;color:#f8f7f1;font-family:Arial,Helvetica,sans-serif}
      img{width:100px;height:100px;border-radius:20px;box-shadow:0 14px 34px #0005}
      h1{margin:0;font-family:Georgia,serif;font-size:38px;line-height:1.03}
      p{margin:15px 0 0;color:#dbe8e2;font-size:18px;line-height:1.3}
    </style></head><body><img src="data:image/png;base64,${iconImage}" alt=""><div><h1>Accent Letters</h1><p>Copy A to Z accents in one click.</p></div></body></html>`, { waitUntil: "load" });
  await promo.screenshot({ path: path.join(output, "chrome-promo-440x280.png") });
  console.log("Created popup and Chrome Web Store artwork.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
