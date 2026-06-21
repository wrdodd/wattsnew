import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Feed } from "../types";

/**
 * Turn every reader's 👍/👎 (reactions.json) into a per-source score: +1 for
 * each upvoted article from an outlet, -1 for each downvoted one, aggregated
 * across all users (the feed is shared). Curation uses this to boost liked
 * sources and suppress disliked ones. Article→source is resolved from the
 * current feed first, then from the curator's dedup memory.
 *
 * reactions.json is `{ user: { articleId: "up"|"down" } }`; an older flat
 * `{ articleId: "up"|"down" }` is still accepted.
 */
export async function computeSourceScores(
  dataDir: string,
  seenSources: Map<string, string>,
): Promise<Map<string, number>> {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(await readFile(join(dataDir, "reactions.json"), "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return new Map();
  }

  // Flatten to [articleId, reaction] across both formats.
  const entries: [string, "up" | "down"][] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (value === "up" || value === "down") {
      entries.push([key, value]); // flat: key is an articleId
    } else if (value && typeof value === "object") {
      for (const [id, r] of Object.entries(value as Record<string, unknown>)) {
        if (r === "up" || r === "down") entries.push([id, r]); // keyed: per user
      }
    }
  }
  if (entries.length === 0) return new Map();

  const idToSource = new Map<string, string>();
  try {
    const feed = JSON.parse(await readFile(join(dataDir, "feed.json"), "utf8")) as Feed;
    for (const a of feed.articles) idToSource.set(a.id, a.source);
  } catch {
    /* no feed yet */
  }
  for (const [id, src] of seenSources) {
    if (!idToSource.has(id)) idToSource.set(id, src);
  }

  const scores = new Map<string, number>();
  for (const [id, reaction] of entries) {
    const source = idToSource.get(id);
    if (!source) continue;
    scores.set(source, (scores.get(source) ?? 0) + (reaction === "up" ? 1 : -1));
  }
  return scores;
}
