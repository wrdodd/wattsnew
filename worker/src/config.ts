export type LlmProvider = "none" | "anthropic" | "openai";

export interface Config {
  dataDir: string;
  maxPerCategory: number;
  recencyHours: number;
  feedRetentionDays: number;
  cron: string;
  timezone: string;
  runOnStart: boolean;
  boostCategory: string;
  boostKeywords: string[];
  llm: {
    provider: LlmProvider;
    anthropicApiKey?: string;
    anthropicModel: string;
    openaiApiKey?: string;
    openaiModel: string;
  };
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(raw);
}

export function loadConfig(): Config {
  const provider = (process.env.LLM_PROVIDER ?? "none").toLowerCase() as LlmProvider;
  return {
    dataDir: process.env.DATA_DIR ?? "/data",
    maxPerCategory: num("MAX_PER_CATEGORY", 10),
    recencyHours: num("RECENCY_HOURS", 48),
    feedRetentionDays: num("FEED_RETENTION_DAYS", 7),
    cron: process.env.CRON ?? "0 8,18 * * *",
    timezone: process.env.TIMEZONE ?? "America/New_York",
    runOnStart: bool("RUN_ON_START", true),
    boostCategory: process.env.BOOST_CATEGORY ?? "Local",
    boostKeywords: (process.env.BOOST_KEYWORDS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    llm: {
      provider: ["none", "anthropic", "openai"].includes(provider) ? provider : "none",
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    },
  };
}
