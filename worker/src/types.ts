export const CATEGORIES = [
  "AI",
  "Business",
  "Entertainment",
  "Gaming",
  "Politics",
  "Science",
  "Tech",
  "Local",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** A single curated news item, as rendered by the website. */
export interface Article {
  /** sha1 of the normalized URL — stable id, also the dedup key. */
  id: string;
  category: Category;
  title: string;
  /** 2–3 sentence plain-text summary (no audio/video dependency). */
  summary: string;
  /** Link to the original, non-paywalled source article. */
  url: string;
  /** Human-readable outlet name, e.g. "Ars Technica". */
  source: string;
  /** ISO timestamp the article was published. */
  publishedAt: string;
  /** ISO timestamp this run added it to the feed. */
  addedAt: string;
  /** Reserved for future "breaking" override handling. */
  breaking: boolean;
}

/** The public feed the website reads from the shared volume. */
export interface Feed {
  generatedAt: string;
  categories: readonly Category[];
  articles: Article[];
}

/** A raw item pulled from an RSS feed before curation. */
export interface RawItem {
  category: Category;
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  /** Best-effort plain-text snippet from the feed (used as the no-LLM summary). */
  snippet: string;
}
