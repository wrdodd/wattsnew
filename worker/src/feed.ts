import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CATEGORIES, type Article, type Feed } from "./types.js";

/** Load the existing public feed, or an empty one if none exists yet. */
export async function loadFeed(dataDir: string): Promise<Feed> {
  try {
    const raw = await readFile(join(dataDir, "feed.json"), "utf8");
    const feed = JSON.parse(raw) as Feed;
    if (Array.isArray(feed.articles)) return feed;
  } catch {
    /* fall through to empty */
  }
  return { generatedAt: new Date().toISOString(), categories: CATEGORIES, articles: [] };
}

/**
 * Merge newly curated articles into the feed, drop anything older than the
 * retention window, and sort newest-added first (so the website sidebar shows
 * "the articles that were added" at the top).
 */
export async function writeFeed(
  dataDir: string,
  existing: Feed,
  fresh: Article[],
  retentionDays: number,
): Promise<Feed> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const byId = new Map<string, Article>();
  for (const a of existing.articles) byId.set(a.id, a);
  for (const a of fresh) byId.set(a.id, a); // fresh wins on id collision

  const articles = [...byId.values()]
    .filter((a) => new Date(a.addedAt).getTime() >= cutoff)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt) || b.publishedAt.localeCompare(a.publishedAt));

  const feed: Feed = {
    generatedAt: new Date().toISOString(),
    categories: CATEGORIES,
    articles,
  };
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "feed.json"), JSON.stringify(feed, null, 2), "utf8");
  return feed;
}
