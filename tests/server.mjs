import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve("src");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

createServer(async (request, response) => {
  const pathname = request.url === "/" ? "/popup.html" : new URL(request.url, "http://127.0.0.1").pathname;
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const details = await stat(file);
    if (!details.isFile()) throw new Error("not a file");
    response.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
    response.setHeader("Cache-Control", "no-store");
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(4173, "127.0.0.1", () => console.log("Popup test server listening on 4173"));

