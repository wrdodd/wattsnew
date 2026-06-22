import type { CuratorConfig } from "./config";
import type { Article, RawItem } from "../types";
import { loadAppConfig } from "./appconfig";
import { fetchCategory } from "./fetch";
import { isPaywalled } from "./paywall";
import { SeenStore } from "./dedup";
import { createSummarizer } from "./llm";
import { loadFeed, writeFeed } from "./feed";
import { computeSourceScores } from "./personalize";
import { searchCategory } from "./searx";
import { idFromUrl, normalizeTitleKey, titleTokenSet, jaccard } from "./util";

// Headlines this similar (Jaccard of meaningful word tokens) are treated as the
// same story even from different outlets — catches reworded wire copy.
const NEAR_DUP_THRESHOLD = 0.7;

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
  const pickedTitleKeys = new Set<string>();
  const pickedTokens: Set<string>[] = [];

  // Same headline (or near-enough) as one already picked this run → skip, so two
  // outlets covering the same story don't both appear. Keeps the higher-ranked.
  const isTitleDup = (c: Candidate): boolean => {
    const key = normalizeTitleKey(c.it.title);
    if (key && pickedTitleKeys.has(key)) return true;
    const tokens = titleTokenSet(c.it.title);
    if (tokens.size >= 4 && pickedTokens.some((p) => jaccard(tokens, p) >= NEAR_DUP_THRESHOLD)) {
      return true;
    }
    return false;
  };
  const remember = (c: Candidate): void => {
    pickedTitleKeys.add(normalizeTitleKey(c.it.title));
    pickedTokens.push(titleTokenSet(c.it.title));
  };

  for (const c of sorted) {
    if (picked.length >= n) break;
    if ((counts.get(c.it.source) ?? 0) >= perSourceCap) continue;
    if (isTitleDup(c)) continue;
    picked.push(c);
    remember(c);
    counts.set(c.it.source, (counts.get(c.it.source) ?? 0) + 1);
  }
  // If the per-source cap left us short, top up by rank ignoring the cap (but
  // still never adding a duplicate headline).
  if (picked.length < n) {
    for (const c of sorted) {
      if (picked.length >= n) break;
      if (picked.includes(c) || isTitleDup(c)) continue;
      picked.push(c);
      remember(c);
    }
  }
  return picked;
}

export interface CategoryResult {
  category: string;
  rss: number;
  searx: number;
  added: number;
}
export interface CurateSummary {
  perCategory: CategoryResult[];
  totalAdded: number;
  feedCount: number;
}

// Prevent scheduled and on-demand runs from overlapping (shared seen/feed files).
let running = false;

/**
 * One curation pass: fetch → filter → dedup → pick → summarize → write.
 * Pass `opts.category` to run a single category on demand (for testing).
 * Guarded so concurrent runs can't race on seen.json / feed.json.
 */
export async function curate(
  config: CuratorConfig,
  opts: { category?: string } = {},
): Promise<CurateSummary> {
  if (running) throw new Error("curation already in progress");
  running = true;
  try {
    return await runCurate(config, opts);
  } finally {
    running = false;
  }
}

async function runCurate(
  config: CuratorConfig,
  opts: { category?: string },
): Promise<CurateSummary> {
  const startedAt = new Date();
  const app = await loadAppConfig(config.dataDir);
  const targetCats = opts.category
    ? app.categories.filter((c) => c.name === opts.category)
    : app.categories;
  if (opts.category && targetCats.length === 0) {
    throw new Error(`unknown category: ${opts.category}`);
  }
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
  const perCategory: CategoryResult[] = [];
  for (const cat of targetCats) {
    const category = cat.name;
    const rssItems = await fetchCategory(category, cat.feeds);

    // Optionally augment RSS with fresh results from a self-hosted SearXNG.
    let searxItems: RawItem[] = [];
    if (config.searxngUrl) {
      const query = cat.query?.trim() || category;
      searxItems = await searchCategory(config.searxngUrl, category, query, app.recencyHours);
    }
    const raw = searxItems.length ? rssItems.concat(searxItems) : rssItems;

    const seenThisRun = new Set<string>();
    const candidates: Candidate[] = [];
    for (const it of raw) {
      const ts = it.publishedAt.getTime();
      if (Number.isNaN(ts) || ts < recencyCutoff) continue; // recent only
      if (isPaywalled(it.url)) continue; // non-paywalled only
      const id = idFromUrl(it.url);
      if (seen.has(id) || seenThisRun.has(id)) continue; // no repeat URLs
      // Skip stories already surfaced in a prior run under a different URL
      // (e.g. the same wire piece picked up later by another outlet).
      if (seen.hasTitle(normalizeTitleKey(it.title))) continue;
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
    const srcNote = config.searxngUrl
      ? `${rssItems.length} RSS + ${searxItems.length} SearXNG`
      : `${raw.length}`;
    console.log(`[curator]   ${category}: ${top.length} new (from ${srcNote} fetched)`);
    perCategory.push({
      category,
      rss: rssItems.length,
      searx: searxItems.length,
      added: top.length,
    });
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
  return { perCategory, totalAdded: fresh.length, feedCount: feed.articles.length };
}
