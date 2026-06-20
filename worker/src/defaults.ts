import type { AppConfig } from "./types.js";

/**
 * Default configuration, written to config.json on first run. Users customize
 * it via the Settings UI (or by editing config.json) — no code changes needed.
 *
 * Feeds are curated to be NON-paywalled and text-first (no video/podcast-only),
 * which keeps the reader friendly for everyone, including text-only readers.
 */
export const DEFAULT_CONFIG: AppConfig = {
  maxPerCategory: 10,
  recencyHours: 48,
  feedRetentionDays: 7,
  boostCategory: "Local",
  boostKeywords: [],
  theme: {
    accent: "oklch(0.705 0.213 47.604)",
    fontScale: "comfortable",
  },
  categories: [
    {
      // AI must use AI-ONLY feeds — general tech feeds would mislabel stories.
      name: "AI",
      feeds: [
        { name: "MarkTechPost", url: "https://www.marktechpost.com/feed/" },
        { name: "The Decoder", url: "https://the-decoder.com/feed/" },
        { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
        { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
        { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/" },
      ],
    },
    {
      name: "Business",
      feeds: [
        { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
        { name: "CNBC", url: "https://www.cnbc.com/id/10001147/device/rss/rss.html" },
        { name: "CNBC", url: "https://www.cnbc.com/id/10000664/device/rss/rss.html" },
      ],
    },
    {
      name: "Entertainment",
      feeds: [
        { name: "Variety", url: "https://variety.com/feed/" },
        { name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/" },
        { name: "Deadline", url: "https://deadline.com/feed/" },
        { name: "Collider", url: "https://collider.com/feed/" },
        { name: "TheWrap", url: "https://www.thewrap.com/feed/" },
      ],
    },
    {
      name: "Gaming",
      feeds: [
        { name: "Polygon", url: "https://www.polygon.com/feed/gaming/" },
        { name: "Eurogamer", url: "https://www.eurogamer.net/feed" },
        { name: "PC Gamer", url: "https://www.pcgamer.com/rss/" },
        { name: "Kotaku", url: "https://kotaku.com/rss" },
        { name: "GameSpot", url: "https://www.gamespot.com/feeds/news/" },
      ],
    },
    {
      name: "Politics",
      feeds: [
        { name: "NPR Politics", url: "https://feeds.npr.org/1014/rss.xml" },
        { name: "BBC Politics", url: "https://feeds.bbci.co.uk/news/politics/rss.xml" },
        { name: "The Hill", url: "https://thehill.com/news/feed/" },
        { name: "The Guardian US Politics", url: "https://www.theguardian.com/us-news/us-politics/rss" },
        { name: "ABC News Politics", url: "https://abcnews.go.com/abcnews/politicsheadlines" },
      ],
    },
    {
      name: "Science",
      feeds: [
        { name: "Phys.org", url: "https://phys.org/rss-feed/" },
        { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml" },
        { name: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/" },
        { name: "NASA", url: "https://www.nasa.gov/feed/" },
        { name: "Ars Technica Science", url: "https://feeds.arstechnica.com/arstechnica/science" },
      ],
    },
    {
      name: "Tech",
      feeds: [
        { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
        { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
        { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
        { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
        { name: "Hacker News", url: "https://hnrss.org/frontpage" },
      ],
    },
    {
      // EXAMPLE local feeds — replace with stations for YOUR area, and set
      // boostKeywords (e.g. your town names) to float nearby stories to the top.
      name: "Local",
      feeds: [
        { name: "KGW", url: "https://www.kgw.com/feeds/syndication/rss/news/local" },
        { name: "KOIN", url: "https://www.koin.com/feed/" },
      ],
    },
  ],
};
