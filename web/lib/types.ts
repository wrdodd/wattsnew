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
  categories: readonly Category[];
  articles: Article[];
}

export type Reaction = "up" | "down";
export type Reactions = Record<string, Reaction>;
