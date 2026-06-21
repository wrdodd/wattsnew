import type { CuratorConfig } from "./config";
import type { Article, RawItem } from "../types";
import { loadAppConfig } from "./appconfig";
import { fetchCategory } from "./fetch";
import { isPaywalled } from "./paywall";
import { SeenStore } from "./dedup";
import { createSummarizer } from "./llm";
import { loadFeed, writeFeed } from "./feed";
import { computeSourceScores } from "./personalize";
import { idFromUrl } from "./util";

type Candidate = { it: RawItem; id: string };

// Boost articles mentioning any of the configured keywords (boostKeywords) to
// the top of the boost category (boostCategory) — e.g. your town for "Local".
function keywordBonus(it: RawItem, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const hay = `${it.title} ${it.snippet}`.toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase())) ? 100 : 0;
}

/**
 * Rank candidates by reader preference (liked sources first, disliked last) plus
 * an optional per-item bonus (e.g. local-area match), breaking ties by recency,
 * then pick the top `n` while capping how many can come from any single source
 * so one outlet can't dominate a category.
 */
function rankAndPick(
  candidates: Candidate[],
  scores: Map<string, number>,
  n: number,
  perSourceCap: number,
  bonus: (it: RawItem) => number = () => 0,
): Candidate[] {
  const effective = (c: Candidate) => (scores.get(c.it.source) ?? 0) + bonus(c.it);
  const sorted = [...candidates].sort((a, b) => {
    const d = effective(b) - effective(a);
    if (d !== 0) return d;
    return b.it.publishedAt.getTime() - a.it.publishedAt.getTime();
  });

  const picked: Candidate[] = [];
  const counts = new Map<string, number>();
  for (const c of sorted) {
    if (picked.length >= n) break;
    if ((counts.get(c.it.source) ?? 0) >= perSourceCap) continue;
    picked.push(c);
    counts.set(c.it.source, (counts.get(c.it.source) ?? 0) + 1);
  }
  // If the per-source cap left us short, top up by rank ignoring the cap.
  if (picked.length < n) {
    for (const c of sorted) {
      if (picked.length >= n) break;
      if (!picked.includes(c)) picked.push(c);
    }
  }
  return picked;
}

/** One full curation pass: fetch → filter → dedup → pick → summarize → write. */
export async function curate(config: CuratorConfig): Promise<void> {
  const startedAt = new Date();
  const app = await loadAppConfig(config.dataDir);
  const seen = new SeenStore(config.dataDir);
  await seen.load();
  const summarizer = createSummarizer(config);
  const recencyCutoff = startedAt.getTime() - app.recencyHours * 3600 * 1000;
  console.log(
    `[curator] [${startedAt.toISOString()}] curate start — model=${summarizer.label}, remembered=${seen.size}`,
  );

  const sourceScores = await computeSourceScores(config.dataDir, seen.sourceMap());
  if (sourceScores.size > 0) {
    const liked = [...sourceScores.values()].filter((s) => s > 0).length;
    const disliked = [...sourceScores.values()].filter((s) => s < 0).length;
    console.log(`[curator]   personalization: ${liked} liked / ${disliked} disliked source(s)`);
  }
  const perSourceCap = Math.max(3, Math.ceil(app.maxPerCategory * 0.5));

  const fresh: Article[] = [];
  for (const cat of app.categories) {
    const category = cat.name;
    const raw = await fetchCategory(category, cat.feeds);

    const seenThisRun = new Set<string>();
    const candidates: Candidate[] = [];
    for (const it of raw) {
      const ts = it.publishedAt.getTime();
      if (Number.isNaN(ts) || ts < recencyCutoff) continue; // recent only
      if (isPaywalled(it.url)) continue; // non-paywalled only
      const id = idFromUrl(it.url);
      if (seen.has(id) || seenThisRun.has(id)) continue; // no repeats
      seenThisRun.add(id);
      candidates.push({ it, id });
    }
    const top = rankAndPick(
      candidates,
      sourceScores,
      app.maxPerCategory,
      perSourceCap,
      category === app.boostCategory ? (it) => keywordBonus(it, app.boostKeywords) : undefined,
    );

    const summaries = await summarizer.summarize(
      category,
      top.map((c) => c.it),
    );
    const addedAt = new Date().toISOString();
    top.forEach(({ it, id }, i) => {
      fresh.push({
        id,
        category,
        title: it.title,
        summary: summaries[i] || it.snippet || `${it.title}.`,
        url: it.url,
        source: it.source,
        publishedAt: it.publishedAt.toISOString(),
        addedAt,
        breaking: false,
      });
      seen.add(id, it.title, it.source);
    });
    console.log(`[curator]   ${category}: ${top.length} new (from ${raw.length} fetched)`);
  }

  // Remember dedup ids a little longer than the feed keeps articles.
  seen.prune(app.feedRetentionDays + 14);
  await seen.save();

  const existing = await loadFeed(config.dataDir);
  const feed = await writeFeed(
    config.dataDir,
    existing,
    fresh,
    app.feedRetentionDays,
    app.categories.map((c) => c.name),
  );
  console.log(
    `[curator] curate done — +${fresh.length} new, feed now holds ${feed.articles.length} articles`,
  );
}
