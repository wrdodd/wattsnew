import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface FeedSource {
  name: string;
  url: string;
}
export interface CategoryConfig {
  name: string;
  feeds: FeedSource[];
}
export type FontScale = "comfortable" | "large" | "xlarge";
export interface ThemeConfig {
  accent: string;
  fontScale: FontScale;
}
export interface AppConfig {
  categories: CategoryConfig[];
  maxPerCategory: number;
  recencyHours: number;
  feedRetentionDays: number;
  boostCategory: string;
  boostKeywords: string[];
  theme: ThemeConfig;
}

const DEFAULT_ACCENT = "oklch(0.705 0.213 47.604)";

const FALLBACK: AppConfig = {
  categories: [],
  maxPerCategory: 10,
  recencyHours: 48,
  feedRetentionDays: 7,
  boostCategory: "Local",
  boostKeywords: [],
  theme: { accent: DEFAULT_ACCENT, fontScale: "comfortable" },
};

function dataDir(): string {
  return process.env.DATA_DIR || "/data";
}

export async function readAppConfig(): Promise<AppConfig> {
  try {
    const cfg = JSON.parse(await readFile(join(dataDir(), "config.json"), "utf8")) as Partial<AppConfig>;
    return {
      ...FALLBACK,
      ...cfg,
      categories: Array.isArray(cfg.categories) ? cfg.categories : [],
      theme: { ...FALLBACK.theme, ...(cfg.theme ?? {}) },
    };
  } catch {
    return FALLBACK;
  }
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Validate + normalize an incoming config, then persist it atomically. */
export async function writeAppConfig(input: Partial<AppConfig>): Promise<AppConfig> {
  const fontScale: FontScale = (["comfortable", "large", "xlarge"] as const).includes(
    input.theme?.fontScale as FontScale,
  )
    ? (input.theme!.fontScale as FontScale)
    : "comfortable";

  const cfg: AppConfig = {
    categories: (input.categories ?? [])
      .map((c) => ({
        name: String(c?.name ?? "").trim(),
        feeds: (c?.feeds ?? [])
          .map((f) => ({ name: String(f?.name ?? "").trim(), url: String(f?.url ?? "").trim() }))
          .filter((f) => f.url),
      }))
      .filter((c) => c.name),
    maxPerCategory: clampInt(input.maxPerCategory, 1, 50, 10),
    recencyHours: clampInt(input.recencyHours, 1, 720, 48),
    feedRetentionDays: clampInt(input.feedRetentionDays, 1, 90, 7),
    boostCategory: String(input.boostCategory ?? "").trim(),
    boostKeywords: Array.isArray(input.boostKeywords)
      ? input.boostKeywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
    theme: { accent: String(input.theme?.accent ?? "").trim() || DEFAULT_ACCENT, fontScale },
  };

  const dir = dataDir();
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `config.json.tmp-${process.pid}`);
  await writeFile(tmp, JSON.stringify(cfg, null, 2), "utf8");
  await rename(tmp, join(dir, "config.json"));
  return cfg;
}
