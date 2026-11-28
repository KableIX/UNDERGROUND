// UNDERGROUND members site (DEV scaffold, branch glm/social).
// Zero dependencies. Serves ./public and fixture JSON. No secrets, no live API, no database.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(root, "public");
const port = Number(process.env.PORT ?? 8795);
const hosts = (process.env.BIND_HOSTS ?? "127.0.0.1").split(",").map((h) => h.trim()).filter(Boolean);
const build = process.env.BUILD_SHA ?? "unknown";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};

const baseHeaders = {
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  "Cache-Control": "no-store",
};

function send(res, status, body, type) {
  res.writeHead(status, { ...baseHeaders, "Content-Type": type });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed", "text/plain");
  if (url.pathname === "/healthz") {
    return send(res, 200, JSON.stringify({ ok: true, service: "members-web-dev", build, time: new Date().toISOString() }), types[".json"]);
  }
  if (url.pathname === "/api/dev/members") {
    const data = await readFile(join(root, "fixtures", "members.json"));
    return send(res, 200, data, types[".json"]);
  }
  const rel = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = resolve(publicDir, "." + normalize(rel));
  if (!file.startsWith(publicDir)) return send(res, 403, "forbidden", "text/plain");
  try {
    const data = await readFile(file);
    return send(res, 200, data, types[extname(file)] ?? "application/octet-stream");
  } catch {
    return send(res, 404, "not found", "text/plain");
  }
});

for (const host of hosts) {
  const s = host === hosts[0] ? server : createServer(server.listeners("request")[0]);
  s.on("error", (err) => {
    console.error(`listen ${host}:${port} failed: ${err.code ?? err.message}`);
    process.exit(1);
  });
  s.listen(port, host, () => console.log(`members-web dev listening on ${host}:${port} build=${build}`));
}