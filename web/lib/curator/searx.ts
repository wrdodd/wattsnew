import type { Category, RawItem } from "../types";
import { stripHtml, truncateWords } from "./util";

// Aggregator / redirect hosts whose links aren't real article pages (the reader
// can't extract them) — skip them in SearXNG results.
const SKIP_HOSTS = new Set([
  "news.google.com",
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
  "msn.com",
  "www.msn.com",
]);

function timeRange(recencyHours: number): string {
  if (recencyHours <= 24) return "day";
  if (recencyHours <= 24 * 7) return "week";
  return "month";
}

interface SearxResult {
  url?: string;
  title?: string;
  content?: string;
  source?: string;
  publishedDate?: string;
}

/**
 * Query a self-hosted SearXNG instance's JSON API for fresh news on a topic and
 * return candidates in the same shape as RSS items, so curation can rank/dedup
 * them alongside the configured feeds. Requires `search.formats: [html, json]`
 * enabled in the SearXNG instance's settings. Failures are non-fatal (returns []).
 */
export async function searchCategory(
  baseUrl: string,
  category: Category,
  query: string,
  recencyHours: number,
  language = "en-US",
): Promise<RawItem[]> {
  const u = new URL("/search", baseUrl);
  u.searchParams.set("q", query);
  u.searchParams.set("format", "json");
  u.searchParams.set("categories", "news");
  u.searchParams.set("time_range", timeRange(recencyHours));
  u.searchParams.set("language", language);

  let data: { results?: SearxResult[] };
  try {
    const res = await fetch(u, {
      headers: { accept: "application/json", "user-agent": "WattsNew/1.0 (+curator)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(
        `  ! ${category}: SearXNG HTTP ${res.status}` +
          (res.status === 403 ? " — enable JSON format (search.formats: [html, json])" : ""),
      );
      return [];
    }
    data = (await res.json()) as { results?: SearxResult[] };
  } catch (err) {
    console.warn(`  ! ${category}: SearXNG query failed: ${String(err).slice(0, 120)}`);
    return [];
  }

  const out: RawItem[] = [];
  for (const r of data.results ?? []) {
    const url = typeof r.url === "string" ? r.url.trim() : "";
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (!url || !title) continue;
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      continue;
    }
    if (SKIP_HOSTS.has(host)) continue;
    const publishedAt = r.publishedDate ? new Date(r.publishedDate) : new Date(NaN);
    const source = r.source?.trim() || host;
    out.push({
      category,
      title: stripHtml(title),
      url,
      source,
      publishedAt,
      snippet: truncateWords(stripHtml(typeof r.content === "string" ? r.content : ""), 60),
    });
  }
  return out;
}
