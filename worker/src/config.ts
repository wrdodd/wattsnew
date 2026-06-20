export type LlmProvider = "none" | "anthropic" | "openai";

/**
 * Environment/runtime config (secrets + scheduling). Feeds, categories, and
 * curation tuning live in config.json instead (see appconfig.ts) so they can be
 * changed from the Settings UI without a restart.
 */
export interface Config {
  dataDir: string;
  cron: string;
  timezone: string;
  runOnStart: boolean;
  llm: {
    provider: LlmProvider;
    anthropicApiKey?: string;
    anthropicModel: string;
    openaiApiKey?: string;
    openaiModel: string;
  };
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
    cron: process.env.CRON ?? "0 8,18 * * *",
    timezone: process.env.TIMEZONE ?? "America/New_York",
    runOnStart: bool("RUN_ON_START", true),
    llm: {
      provider: ["none", "anthropic", "openai"].includes(provider) ? provider : "none",
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    },
  };
}
