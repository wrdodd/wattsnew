/** Fallback category order, used only if config.json can't be read. */
export const DEFAULT_CATEGORIES = [
  "AI",
  "Business",
  "Entertainment",
  "Gaming",
  "Politics",
  "Science",
  "Tech",
  "Local",
] as const;

export type Category = string;

export interface Article {
  id: string;
  category: Category;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  addedAt: string;
  breaking: boolean;
}

export interface Feed {
  generatedAt: string;
  categories: string[];
  articles: Article[];
}

export type Reaction = "up" | "down";
export type Reactions = Record<string, Reaction>;
