import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

interface SeenEntry {
  title: string;
  source?: string;
  firstSeenAt: string;
}

type SeenMap = Record<string, SeenEntry>;

/**
 * The worker's cross-run memory: every article id it has ever surfaced.
 * Strict URL-level dedup means the same article never reappears; a genuine
 * "breaking update" is a different URL, so it still comes through.
 */
export class SeenStore {
  private map: SeenMap = {};
  private readonly path: string;

  constructor(dataDir: string) {
    this.path = join(dataDir, "seen.json");
  }

  async load(): Promise<void> {
    try {
      this.map = JSON.parse(await readFile(this.path, "utf8")) as SeenMap;
    } catch {
      this.map = {};
    }
  }

  has(id: string): boolean {
    return id in this.map;
  }

  add(id: string, title: string, source?: string): void {
    if (!this.map[id]) this.map[id] = { title, source, firstSeenAt: new Date().toISOString() };
  }

  /** id → source, for entries that recorded it (used by personalization). */
  sourceMap(): Map<string, string> {
    const m = new Map<string, string>();
    for (const [id, entry] of Object.entries(this.map)) {
      if (entry.source) m.set(id, entry.source);
    }
    return m;
  }

  /** Drop memories older than `days` so the file stays small. */
  prune(days: number): void {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    for (const [id, entry] of Object.entries(this.map)) {
      if (new Date(entry.firstSeenAt).getTime() < cutoff) delete this.map[id];
    }
  }

  get size(): number {
    return Object.keys(this.map).length;
  }

  async save(): Promise<void> {
    await mkdir(join(this.path, ".."), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.map, null, 2), "utf8");
  }
}
