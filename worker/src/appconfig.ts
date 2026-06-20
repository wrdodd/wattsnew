import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./defaults.js";

/**
 * Load config.json from the shared volume. On first run (no file yet) the
 * defaults are written out so users have something to edit. Missing fields are
 * filled from defaults so older config files keep working as the schema grows.
 */
export async function loadAppConfig(dataDir: string): Promise<AppConfig> {
  const path = join(dataDir, "config.json");
  try {
    const cfg = JSON.parse(await readFile(path, "utf8")) as Partial<AppConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...cfg,
      theme: { ...DEFAULT_CONFIG.theme, ...(cfg.theme ?? {}) },
      categories:
        Array.isArray(cfg.categories) && cfg.categories.length > 0
          ? cfg.categories
          : DEFAULT_CONFIG.categories,
    };
  } catch {
    try {
      await mkdir(dataDir, { recursive: true });
      await writeFile(path, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf8");
    } catch {
      /* read-only or racing; fall back to in-memory defaults */
    }
    return DEFAULT_CONFIG;
  }
}
