// Fake data and the sign-in gate for the dev members site. No real member data, no secrets.
// The server asks this module for a page or a garage and gets back exactly what that signed-in
// member may see, so private content never leaves the server.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  garageLook,
  pageIsVisibleTo,
  projectGarageForViewer,
  projectPageForVisitor,
  restoreSettings,
  validGarageDocument,
  validPageDocument,
} from "../public/schema.js";

export const SESSION_COOKIE = "ug_dev_session";
const MEMBER_NUMBER = /^[0-9]{6}$/;
const MEMBER_ID = /^[a-z0-9][a-z0-9-]{0,63}$/i;

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at <= 0) continue;
    try {
      cookies[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim());
    } catch {
      // A cookie value that is not valid encoding is ignored.
    }
  }
  return cookies;
}

/** Reads a small JSON body. Returns null when it is missing, too large or not JSON. */
export async function readJsonBody(req, limit = 2048) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

const reply = (status, body) => ({ status, body });

/**
 * Loads the fixtures once and answers as the dev data source. Throws at start-up when a fixture
 * file is malformed, so a broken fixture never turns into a half-working site.
 */
export async function createDevData(root) {
  const fixtures = join(root, "fixtures");
  const book = JSON.parse(await readFile(join(fixtures, "members.json"), "utf8"));
  if (!Array.isArray(book.members) || book.members.length === 0) {
    throw new Error("fixtures/members.json must list at least one member");
  }
  const byId = new Map();
  for (const m of book.members) {
    if (!MEMBER_ID.test(m.id) || !MEMBER_NUMBER.test(m.number) || typeof m.name !== "string" || !m.name) {
      throw new Error("fixtures/members.json has an invalid member");
    }
    byId.set(m.id, { id: m.id, number: m.number, name: m.name, founder: m.founder === true });
  }
  const friends = new Set();
  for (const [a, b] of Array.isArray(book.friends) ? book.friends : []) {
    if (!byId.has(a) || !byId.has(b)) throw new Error("fixtures/members.json has an invalid friendship");
    friends.add(`${a}|${b}`);
    friends.add(`${b}|${a}`);
  }

  async function loadJson(relative) {
    let text;
    try {
      text = await readFile(join(fixtures, relative), "utf8");
    } catch {
      return null; // no file for this member yet: start from an empty page
    }
    return JSON.parse(text);
  }

  function sessionMember(cookieHeader) {
    const id = parseCookies(cookieHeader)[SESSION_COOKIE];
    return typeof id === "string" && byId.has(id) ? byId.get(id) : null;
  }

  /** owner, friend or member for a signed-in viewer; null when nobody is signed in. */
  function viewerOf(cookieHeader, targetId) {
    const who = sessionMember(cookieHeader);
    if (!who) return null;
    if (who.id === targetId) return "owner";
    return friends.has(`${who.id}|${targetId}`) ? "friend" : "member";
  }

  async function pageDocument(memberId) {
    const member = byId.get(memberId);
    const stored = await loadJson(join("pages", `${memberId}.json`));
    if (stored) return stored;
    return {
      member,
      settings: restoreSettings(member.name, null),
      revision: 0,
      verifiedRuns: null,
      territories: null,
      friendCount: 0,
      clout: null,
      vehicles: [],
      featuredFriends: [],
    };
  }

  /** The page rules name two kinds of visitor. The owner is handled separately. */
  const visitorKind = (viewer) => (viewer === "friend" ? "friends" : "members");

  const denied = (status, error) => reply(status, { ok: false, error });
  const publicMember = (m) => ({ id: m.id, number: m.number, name: m.name, founder: m.founder });

  const list = () => [...byId.values()].sort((a, b) => a.number.localeCompare(b.number)).map(publicMember);

  return {
    publicMember,
    memberByNumber: (number) => [...byId.values()].find((m) => m.number === number) ?? null,
    /** The raw list of fixture members, by number. */
    directory: list,

    /** Whether the browser is signed in, read from the cookie header exactly as it was sent. */
    session(cookieHeader) {
      const member = sessionMember(cookieHeader);
      return { signedIn: !!member, member: member ? publicMember(member) : null };
    },

    /** The member list, for a signed-in member only. */
    directoryFor(cookieHeader) {
      if (!sessionMember(cookieHeader)) return denied(401, "sign_in_required");
      return reply(200, { ok: true, members: list() });
    },

    /** The page for `memberId`, as this signed-in viewer may see it. */
    async page(memberId, cookieHeader) {
      const viewer = viewerOf(cookieHeader, memberId);
      if (!viewer) return denied(401, "sign_in_required");
      if (!MEMBER_ID.test(memberId) || !byId.has(memberId)) return denied(404, "member_not_found");
      const doc = await pageDocument(memberId);
      if (!validPageDocument(doc) || doc.member.id !== memberId) return denied(500, "page_unavailable");
      // The owner sees everything. Anyone else is a friend or another member, as far as the rules go.
      const shown = viewer === "owner" ? doc : projectPageForVisitor(doc, visitorKind(viewer));
      if (!shown) return denied(403, "page_unavailable");
      return reply(200, { ok: true, viewer, page: shown });
    },

    /**
     * The garage for `memberId`. It follows the same rule as the "My garage" section of the page:
     * whoever may see that section may open the garage, and each car still follows its own visibility.
     */
    async garage(memberId, cookieHeader) {
      const viewer = viewerOf(cookieHeader, memberId);
      if (!viewer) return denied(401, "sign_in_required");
      if (!MEMBER_ID.test(memberId) || !byId.has(memberId)) return denied(404, "member_not_found");
      const doc = await pageDocument(memberId);
      if (!validPageDocument(doc) || doc.member.id !== memberId) return denied(500, "garage_unavailable");
      const settings = restoreSettings(doc.member.name, doc.settings);
      const open =
        viewer === "owner" ||
        (!settings.look.hidden.includes("collection") &&
          pageIsVisibleTo(settings.custom.access.collection ?? "members", visitorKind(viewer)));
      if (!open) return denied(403, "garage_unavailable");
      const stored = (await loadJson(join("garages", `${memberId}.json`))) ?? { member: doc.member, cars: [] };
      if (!validGarageDocument(stored) || stored.member.id !== memberId) return denied(500, "garage_unavailable");
      return reply(200, { ok: true, viewer, garage: projectGarageForViewer(stored, viewer), look: garageLook(settings) });
    },
  };
}
