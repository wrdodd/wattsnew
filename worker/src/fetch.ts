import Parser from "rss-parser";
import type { Category, FeedSource, RawItem } from "./types.js";
import { stripHtml, truncateWords } from "./util.js";

const parser = new Parser({
  timeout: 15000,
  // Browser-like UA — several outlets (e.g. Politico) 403 a bot-identifying UA.
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
});

async function fetchSource(category: Category, source: FeedSource): Promise<RawItem[]> {
  const feed = await parser.parseURL(source.url);
  const out: RawItem[] = [];
  for (const item of feed.items ?? []) {
    const url = item.link?.trim();
    const title = item.title?.trim();
    if (!url || !title) continue;
    const dateStr = item.isoDate ?? item.pubDate;
    const publishedAt = dateStr ? new Date(dateStr) : new Date(NaN);
    const rawSnippet = item.contentSnippet ?? item.summary ?? item.content ?? "";
    out.push({
      category,
      title: stripHtml(title),
      url,
      source: source.name,
      publishedAt,
      snippet: truncateWords(stripHtml(rawSnippet), 60),
    });
  }
  return out;
}

/** Pull every source for a category, tolerating dead/slow feeds. */
export async function fetchCategory(category: Category, sources: FeedSource[]): Promise<RawItem[]> {
  const settled = await Promise.allSettled(sources.map((s) => fetchSource(category, s)));
  const items: RawItem[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i]!;
    if (r.status === "fulfilled") {
      items.push(...r.value);
    } else {
      console.warn(`  ! ${category}: feed failed (${sources[i]!.name}): ${String(r.reason).slice(0, 120)}`);
    }
  }
  return items;
}
