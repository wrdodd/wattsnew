import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const SESSION_COOKIE = "dn_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

let cachedSecret: string | null = null;

/**
 * Cookie-signing secret. Uses AUTH_SECRET if set; otherwise generates one and
 * persists it to the data volume so sessions survive restarts (zero-config).
 */
function resolveSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (cachedSecret) return cachedSecret;
  const dir = process.env.DATA_DIR || "/data";
  const path = join(dir, ".auth_secret");
  try {
    const existing = readFileSync(path, "utf8").trim();
    if (existing) return (cachedSecret = existing);
  } catch {
    /* not created yet */
  }
  cachedSecret = randomBytes(32).toString("hex");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, cachedSecret, { mode: 0o600 });
  } catch {
    /* fall back to in-memory (regenerates on restart) */
  }
  return cachedSecret;
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function fromB64url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Signed session token carrying the username: base64url(user).hmac. */
export function sessionToken(username: string): string {
  const payload = b64url(username);
  const sig = createHmac("sha256", resolveSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** Username from a valid session cookie, or null. */
export function sessionUser(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)dn_session=([^;]+)/);
  if (!m) return null;
  const dot = m[1]!.indexOf(".");
  if (dot < 1) return null;
  const payload = m[1]!.slice(0, dot);
  const sig = m[1]!.slice(dot + 1);
  const expected = createHmac("sha256", resolveSecret()).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return null;
  try {
    return fromB64url(payload);
  } catch {
    return null;
  }
}

export function isAuthed(req: Request): boolean {
  return sessionUser(req) !== null;
}

/** True when the request reached us over HTTPS (directly or via a proxy). */
export function isSecureRequest(req: Request): boolean {
  const xf = req.headers.get("x-forwarded-proto");
  if (xf) return xf.split(",")[0]!.trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionSetCookie(username: string, secure: boolean): string {
  const flags = `Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Lax`;
  return `${SESSION_COOKIE}=${sessionToken(username)}; ${flags}; Max-Age=${MAX_AGE}`;
}

export function sessionClearCookie(secure: boolean): string {
  const flags = `Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Lax`;
  return `${SESSION_COOKIE}=; ${flags}; Max-Age=0`;
}

/** Shared 401 helper for protected API routes. */
export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
