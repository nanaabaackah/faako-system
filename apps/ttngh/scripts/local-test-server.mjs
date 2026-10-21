import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname } from "node:path";
export async function localTestServer() {
  const root = fileURLToPath(new URL("../dist/", import.meta.url));
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (!extname(path)) path = path.replace(/\/$/, "") + "/index.html";
      const file = resolve(root, "." + path);
      if (!file.startsWith(root)) throw new Error("Outside build");
      res.setHeader("Content-Type", ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" })[extname(file)] || "application/octet-stream");
      res.end(await readFile(file));
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { origin: "http://127.0.0.1:" + server.address().port, close: () => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); } };
}
