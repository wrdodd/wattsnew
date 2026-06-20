/** A category is just a name now — defined in config.json, not hardcoded. */
export type Category = string;

export interface FeedSource {
  name: string;
  url: string;
}

export interface CategoryConfig {
  name: string;
  feeds: FeedSource[];
}

export interface ThemeConfig {
  /** CSS color for the accent (e.g. an oklch() or hex string). */
  accent: string;
  /** Reading text size preset. */
  fontScale: "comfortable" | "large" | "xlarge";
}

/** The full app configuration, persisted to config.json on the shared volume. */
export interface AppConfig {
  categories: CategoryConfig[];
  maxPerCategory: number;
  recencyHours: number;
  feedRetentionDays: number;
  /** Category whose articles get boosted when they match boostKeywords. */
  boostCategory: string;
  boostKeywords: string[];
  theme: ThemeConfig;
}

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
  categories: string[];
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
