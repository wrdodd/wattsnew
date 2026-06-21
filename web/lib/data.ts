import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type Feed, type Reaction, type Reactions } from "./types";

/** Shared volume mounted at /data in the container; overridable for local dev. */
export function dataDir(): string {
  return process.env.DATA_DIR || "/data";
}

export async function readFeed(): Promise<Feed> {
  try {
    const raw = await readFile(join(dataDir(), "feed.json"), "utf8");
    const feed = JSON.parse(raw) as Feed;
    if (Array.isArray(feed.articles)) return feed;
  } catch {
    /* no feed yet */
  }
  return { generatedAt: new Date(0).toISOString(), categories: [], articles: [] };
}

// reactions.json is keyed by username → { articleId: "up" | "down" }.
type AllReactions = Record<string, Reactions>;

async function readAllReactions(): Promise<AllReactions> {
  try {
    return JSON.parse(await readFile(join(dataDir(), "reactions.json"), "utf8")) as AllReactions;
  } catch {
    return {};
  }
}

export async function readReactions(user: string): Promise<Reactions> {
  return (await readAllReactions())[user] ?? {};
}

/** Set or clear a reaction for one user, then persist atomically. */
export async function setReaction(
  user: string,
  id: string,
  reaction: Reaction | null,
): Promise<Reactions> {
  const all = await readAllReactions();
  const mine = all[user] ?? {};
  if (reaction === null) delete mine[id];
  else mine[id] = reaction;
  all[user] = mine;

  const dir = dataDir();
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `reactions.json.tmp-${process.pid}`);
  await writeFile(tmp, JSON.stringify(all, null, 2), "utf8");
  await rename(tmp, join(dir, "reactions.json"));
  return mine;
}
