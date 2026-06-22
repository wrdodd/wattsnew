import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { Article, Feed } from "../types";
import { normalizeTitleKey } from "./util";

/** Load the existing public feed, or an empty one if none exists yet. */
export async function loadFeed(dataDir: string): Promise<Feed> {
  try {
    const raw = await readFile(join(dataDir, "feed.json"), "utf8");
    const feed = JSON.parse(raw) as Feed;
    if (Array.isArray(feed.articles)) return feed;
  } catch {
    /* fall through to empty */
  }
  return { generatedAt: new Date().toISOString(), categories: [], articles: [] };
}

/**
 * Merge newly curated articles into the feed, drop anything older than the
 * retention window, and sort newest-added first (so the website sidebar shows
 * "the articles that were added" at the top). Written atomically.
 */
export async function writeFeed(
  dataDir: string,
  existing: Feed,
  fresh: Article[],
  retentionDays: number,
  categories: string[],
): Promise<Feed> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const byId = new Map<string, Article>();
  for (const a of existing.articles) byId.set(a.id, a);
  for (const a of fresh) byId.set(a.id, a); // fresh wins on id collision

  const sorted = [...byId.values()]
    .filter((a) => new Date(a.addedAt).getTime() >= cutoff)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt) || b.publishedAt.localeCompare(a.publishedAt));

  // Collapse same-headline duplicates (e.g. the same story from KGW and KOIN),
  // keeping the freshest copy. Cleans up any twins already in the feed too.
  const seenTitles = new Set<string>();
  const articles = sorted.filter((a) => {
    const key = normalizeTitleKey(a.title);
    if (!key) return true;
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  const feed: Feed = {
    generatedAt: new Date().toISOString(),
    categories,
    articles,
  };
  await mkdir(dataDir, { recursive: true });
  const tmp = join(dataDir, `feed.json.tmp-${process.pid}`);
  await writeFile(tmp, JSON.stringify(feed, null, 2), "utf8");
  await rename(tmp, join(dataDir, "feed.json"));
  return feed;
}
