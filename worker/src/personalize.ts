import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Feed } from "./types.js";

type Reactions = Record<string, "up" | "down">;

/**
 * Turn the reader's 👍/👎 (reactions.json, written by the website) into a
 * per-source score: +1 for each upvoted article from that outlet, -1 for each
 * downvoted one. Curation uses this to boost liked sources and suppress
 * disliked ones. Article→source is resolved from the current feed first, then
 * from the worker's dedup memory.
 */
export async function computeSourceScores(
  dataDir: string,
  seenSources: Map<string, string>,
): Promise<Map<string, number>> {
  let reactions: Reactions = {};
  try {
    reactions = JSON.parse(await readFile(join(dataDir, "reactions.json"), "utf8")) as Reactions;
  } catch {
    return new Map();
  }

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
  for (const [id, reaction] of Object.entries(reactions)) {
    const source = idToSource.get(id);
    if (!source) continue;
    scores.set(source, (scores.get(source) ?? 0) + (reaction === "up" ? 1 : -1));
  }
  return scores;
}
