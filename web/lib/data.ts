import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CATEGORIES, type Feed, type Reaction, type Reactions } from "./types";

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
  return { generatedAt: new Date(0).toISOString(), categories: CATEGORIES, articles: [] };
}

export async function readReactions(): Promise<Reactions> {
  try {
    const raw = await readFile(join(dataDir(), "reactions.json"), "utf8");
    return JSON.parse(raw) as Reactions;
  } catch {
    return {};
  }
}

/** Set or clear a reaction, then persist atomically (tmp file + rename). */
export async function setReaction(id: string, reaction: Reaction | null): Promise<Reactions> {
  const reactions = await readReactions();
  if (reaction === null) {
    delete reactions[id];
  } else {
    reactions[id] = reaction;
  }
  const dir = dataDir();
  await mkdir(dir, { recursive: true });
  const target = join(dir, "reactions.json");
  const tmp = join(dir, `reactions.json.tmp-${process.pid}`);
  await writeFile(tmp, JSON.stringify(reactions, null, 2), "utf8");
  await rename(tmp, target);
  return reactions;
}
