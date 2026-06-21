import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const SESSION_COOKIE = "dn_session";
const MESSAGE = "dailynews.session.v1";
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

/** Deterministic session token = HMAC(secret, fixed message). */
export function sessionToken(): string {
  return createHmac("sha256", resolveSecret()).update(MESSAGE).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** True if the request carries a valid session cookie. */
export function isAuthed(req: Request): boolean {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)dn_session=([^;]+)/);
  if (!m) return false;
  return safeEqual(m[1]!, sessionToken());
}

export function checkCredentials(username: string, password: string): boolean {
  const u = process.env.DASHBOARD_USER || "";
  const p = process.env.DASHBOARD_PASSWORD || "";
  return p.length > 0 && username === u && password === p;
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

export function sessionSetCookie(secure: boolean): string {
  const flags = `Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Lax`;
  return `${SESSION_COOKIE}=${sessionToken()}; ${flags}; Max-Age=${MAX_AGE}`;
}

export function sessionClearCookie(secure: boolean): string {
  const flags = `Path=/; HttpOnly;${secure ? " Secure;" : ""} SameSite=Lax`;
  return `${SESSION_COOKIE}=; ${flags}; Max-Age=0`;
}

/** Shared 401 helper for protected API routes. */
export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
