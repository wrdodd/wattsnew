import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export type Role = "admin" | "user";
export interface UserRecord {
  passwordHash: string;
  role: Role;
  createdAt: string;
}
type Users = Record<string, UserRecord>;

function dir(): string {
  return process.env.DATA_DIR || "/data";
}
function file(): string {
  return join(dir(), "users.json");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const dk = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${dk}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, dk] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !dk) return false;
  const calc = scryptSync(password, salt, 64);
  const expected = Buffer.from(dk, "hex");
  return calc.length === expected.length && timingSafeEqual(calc, expected);
}

async function readUsers(): Promise<Users> {
  try {
    return JSON.parse(await readFile(file(), "utf8")) as Users;
  } catch {
    return {};
  }
}

async function writeUsers(users: Users): Promise<void> {
  const d = dir();
  await mkdir(d, { recursive: true });
  const tmp = join(d, `users.json.tmp-${process.pid}`);
  await writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
  await rename(tmp, file());
}

/** On first run, seed the initial admin from DASHBOARD_USER/PASSWORD env. */
export async function ensureSeeded(): Promise<void> {
  const users = await readUsers();
  if (Object.keys(users).length > 0) return;
  const name = (process.env.DASHBOARD_USER || "admin").trim();
  const pass = process.env.DASHBOARD_PASSWORD || "";
  if (!pass) return; // no bootstrap creds; first admin must be added another way
  users[name] = { passwordHash: hashPassword(pass), role: "admin", createdAt: new Date().toISOString() };
  await writeUsers(users);
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  await ensureSeeded();
  const rec = (await readUsers())[username];
  return !!rec && verifyPassword(password, rec.passwordHash);
}

export async function getUser(username: string): Promise<UserRecord | null> {
  return (await readUsers())[username] ?? null;
}

export async function listUsers(): Promise<{ username: string; role: Role; createdAt: string }[]> {
  const users = await readUsers();
  return Object.entries(users).map(([username, r]) => ({
    username,
    role: r.role,
    createdAt: r.createdAt,
  }));
}

export async function addUser(username: string, password: string, role: Role = "user"): Promise<void> {
  username = username.trim();
  if (!username || !password) throw new Error("username and password required");
  const users = await readUsers();
  if (users[username]) throw new Error("user already exists");
  users[username] = { passwordHash: hashPassword(password), role, createdAt: new Date().toISOString() };
  await writeUsers(users);
}

export async function deleteUser(username: string): Promise<void> {
  const users = await readUsers();
  delete users[username];
  await writeUsers(users);
}

export async function setPassword(username: string, password: string): Promise<void> {
  const users = await readUsers();
  const rec = users[username];
  if (!rec) throw new Error("no such user");
  rec.passwordHash = hashPassword(password);
  await writeUsers(users);
}
