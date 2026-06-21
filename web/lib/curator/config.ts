export type LlmProvider = "none" | "anthropic" | "openai";

/**
 * Runtime config for the in-process curator (secrets + scheduling). Feeds,
 * categories, and curation tuning live in config.json instead (see
 * ../appconfig.ts and ./appconfig.ts) so they can be changed from the Settings
 * UI without a restart.
 */
export interface CuratorConfig {
  dataDir: string;
  cron: string;
  timezone: string;
  runOnStart: boolean;
  enabled: boolean;
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

export function loadCuratorConfig(): CuratorConfig {
  const provider = (process.env.LLM_PROVIDER ?? "none").toLowerCase() as LlmProvider;
  return {
    dataDir: process.env.DATA_DIR ?? "/data",
    cron: process.env.CRON ?? "0 8,18 * * *",
    timezone: process.env.TIMEZONE ?? process.env.TZ ?? "America/New_York",
    runOnStart: bool("RUN_ON_START", true),
    // Lets multi-replica deployments run curation on exactly one instance.
    enabled: bool("CURATOR_ENABLED", true),
    llm: {
      provider: ["none", "anthropic", "openai"].includes(provider) ? provider : "none",
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    },
  };
}
