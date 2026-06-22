import { createHash } from "node:crypto";

/** Normalize a URL for dedup: drop tracking params, trailing slash, fragment. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    const drop = [...u.searchParams.keys()].filter(
      (k) => k.startsWith("utm_") || ["fbclid", "gclid", "ref", "ref_src", "cmpid"].includes(k),
    );
    for (const k of drop) u.searchParams.delete(k);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function idFromUrl(url: string): string {
  return createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 16);
}

/** Strip HTML tags and decode the handful of entities that show up in RSS. */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function safeCodePoint(cp: number): string {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

// Short, common words ignored when comparing headlines for near-duplicates.
const TITLE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "at", "by",
  "from", "as", "is", "are", "was", "were", "be", "this", "that", "it", "its", "but",
  "new", "says", "say", "said", "after", "over", "amid", "into", "out", "how", "why",
  "what", "who", "his", "her", "their", "you", "your", "will", "has", "have",
]);

/**
 * Canonical key for a headline: lowercased, punctuation/entities stripped,
 * whitespace collapsed. Two outlets running the same wire story usually share an
 * identical key, so this catches cross-source duplicates that URL dedup misses.
 */
export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Meaningful word tokens of a headline (stopwords + very short words dropped). */
export function titleTokenSet(title: string): Set<string> {
  return new Set(
    normalizeTitleKey(title)
      .split(" ")
      .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w)),
  );
}

/** Jaccard overlap of two token sets (0–1); for near-duplicate headline detection. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Trim text to roughly `maxWords`, ending on a word boundary. */
export function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ").replace(/[,;:]?$/, "") + "…";
}
