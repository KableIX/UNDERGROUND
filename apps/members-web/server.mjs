// UNDERGROUND members site (DEV, branch glm/social).
// Zero dependencies. Serves ./public with fixtures only. No secrets, no live API, no database.
// Every page and garage is checked against the token rules before it is sent, and anything the
// signed-in member may not see is removed on this side, so it never reaches their browser.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SESSION_COOKIE, createDevData, readJsonBody } from "./lib/dev-data.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(root, "public");
const port = Number(process.env.PORT ?? 8795);
const hosts = (process.env.BIND_HOSTS ?? "127.0.0.1").split(",").map((h) => h.trim()).filter(Boolean);
const build = process.env.BUILD_SHA ?? "unknown";
const data = await createDevData(root);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};

const baseHeaders = {
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  // No inline script or style. Themes are applied by script through CSS variables, which this allows.
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
  "Cache-Control": "no-store",
};

function send(res, status, body, type, extraHeaders = {}) {
  res.writeHead(status, { ...baseHeaders, ...extraHeaders, "Content-Type": type });
  res.end(body);
}

function json(res, status, value, extraHeaders = {}) {
  send(res, status, JSON.stringify(value), types[".json"], extraHeaders);
}

const sessionCookie = (value, maxAge) =>
  `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
const PAGE_URL = /^\/api\/dev\/members\/([a-z0-9][a-z0-9-]{0,63})\/page$/i;
const GARAGE_URL = /^\/api\/dev\/members\/([a-z0-9][a-z0-9-]{0,63})\/garage$/i;

/** Serves one file from public/, or 404. Dotfiles, TypeScript sources and maps are never served. */
async function serveStatic(res, path) {
  const file = resolve(publicDir, "." + (path === "/" ? "/index.html" : path));
  const inside = relative(publicDir, file);
  const hidden =
    !inside ||
    inside.startsWith("..") ||
    isAbsolute(inside) ||
    inside.split(/[\\/]/).some((part) => part.startsWith(".")) ||
    inside.endsWith(".ts") ||
    inside.endsWith(".map");
  if (hidden) return send(res, 404, "not found", "text/plain");
  try {
    return send(res, 200, await readFile(file), types[extname(file).toLowerCase()] ?? "application/octet-stream");
  } catch {
    return send(res, 404, "not found", "text/plain");
  }
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  try {
    if (req.method === "POST" && path === "/api/dev/sign-in") {
      const body = await readJsonBody(req);
      const number = typeof body?.memberNumber === "string" ? body.memberNumber.trim() : "";
      const member = number ? data.memberByNumber(number) : null;
      if (!member) return json(res, 401, { ok: false, error: "unknown_member" });
      return json(res, 200, { ok: true, member: data.publicMember(member) }, { "Set-Cookie": sessionCookie(member.id, 43200) });
    }
    if (req.method === "POST" && path === "/api/dev/sign-out") {
      return json(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed", "text/plain");
    if (path === "/healthz") {
      return json(res, 200, { ok: true, service: "members-web-dev", build, time: new Date().toISOString() });
    }
    if (path === "/api/dev/session") return json(res, 200, data.session(req.headers.cookie));
    if (path === "/api/dev/members") {
      const answer = data.directoryFor(req.headers.cookie);
      return json(res, answer.status, answer.body);
    }
    const page = PAGE_URL.exec(path);
    if (page) {
      const answer = await data.page(page[1], req.headers.cookie);
      return json(res, answer.status, answer.body);
    }
    const garage = GARAGE_URL.exec(path);
    if (garage) {
      const answer = await data.garage(garage[1], req.headers.cookie);
      return json(res, answer.status, answer.body);
    }
    if (path.startsWith("/api/")) return json(res, 404, { ok: false, error: "not_found" });
    return serveStatic(res, path);
  } catch (error) {
    process.stderr.write(`${error?.stack ?? error}\n`);
    return json(res, 500, { ok: false, error: "server_error" });
  }
});

for (const host of hosts) {
  const s = host === hosts[0] ? server : createServer(server.listeners("request")[0]);
  s.on("error", (err) => {
    process.stderr.write(`listen ${host}:${port} failed: ${err.code ?? err.message}\n`);
    process.exit(1);
  });
  s.listen(port, host, () => process.stdout.write(`members-web dev listening on ${host}:${port} build=${build}\n`));
}
