"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  FloppyDisk,
  ArrowLeft,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { applyTheme } from "@/lib/theme";

interface FeedSource {
  name: string;
  url: string;
}
interface CategoryConfig {
  name: string;
  feeds: FeedSource[];
}
interface AppConfig {
  categories: CategoryConfig[];
  maxPerCategory: number;
  recencyHours: number;
  feedRetentionDays: number;
  boostCategory: string;
  boostKeywords: string[];
  theme: { accent: string; fontScale: "comfortable" | "large" | "xlarge" };
}

const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: "Orange", value: "oklch(0.705 0.213 47.604)" },
  { name: "Blue", value: "oklch(0.62 0.19 250)" },
  { name: "Green", value: "oklch(0.7 0.17 150)" },
  { name: "Purple", value: "oklch(0.6 0.22 300)" },
  { name: "Red", value: "oklch(0.62 0.23 25)" },
  { name: "Teal", value: "oklch(0.7 0.12 195)" },
];

const inputCls =
  "h-10 w-full rounded-lg border border-input bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export default function SettingsPage() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then(setCfg)
      .catch(() => {});
  }, []);

  function patch(p: Partial<AppConfig>) {
    setCfg((c) => (c ? { ...c, ...p } : c));
    setStatus("idle");
  }
  function patchTheme(p: Partial<AppConfig["theme"]>) {
    setCfg((c) => {
      if (!c) return c;
      const theme = { ...c.theme, ...p };
      applyTheme(theme); // live preview
      return { ...c, theme };
    });
    setStatus("idle");
  }
  function patchCategories(categories: CategoryConfig[]) {
    patch({ categories });
  }

  async function save() {
    if (!cfg) return;
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "save failed");
      const saved = (await res.json()) as AppConfig;
      setCfg(saved);
      applyTheme(saved.theme);
      setStatus("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
      setStatus("error");
    }
  }

  if (!cfg) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-lg" variant="ghost" title="Back to reader">
            <Link href="/">
              <ArrowLeft size={20} />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          {status === "saved" && <span className="text-sm text-primary">Saved</span>}
          {status === "error" && <span className="text-sm text-destructive">{error}</span>}
          <Button size="lg" className="rounded-full" onClick={save} disabled={status === "saving"}>
            <FloppyDisk size={18} />
            {status === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <p className="mb-8 text-sm text-muted-foreground">
        Feed and category changes apply on the next scheduled curation run. Theme changes apply
        immediately.
      </p>

      {/* Theme */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Theme</h2>
        <label className="mb-2 block text-sm font-medium">Accent color</label>
        <div className="mb-3 flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => patchTheme({ accent: p.value })}
              title={p.name}
              className="size-9 rounded-full border-2"
              style={{
                backgroundColor: p.value,
                borderColor: cfg.theme.accent === p.value ? "var(--foreground)" : "transparent",
              }}
            />
          ))}
        </div>
        <input
          className={inputCls + " mb-4 max-w-sm"}
          value={cfg.theme.accent}
          onChange={(e) => patchTheme({ accent: e.target.value })}
          placeholder="any CSS color, e.g. #fb7a18 or oklch(...)"
        />

        <label className="mb-2 block text-sm font-medium">Reading size</label>
        <div className="flex gap-2">
          {(["comfortable", "large", "xlarge"] as const).map((s) => (
            <Button
              key={s}
              variant={cfg.theme.fontScale === s ? "default" : "outline"}
              className="rounded-full capitalize"
              onClick={() => patchTheme({ fontScale: s })}
            >
              {s === "xlarge" ? "X-Large" : s}
            </Button>
          ))}
        </div>
      </section>

      {/* Curation */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Curation</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField
            label="Articles per category"
            value={cfg.maxPerCategory}
            onChange={(v) => patch({ maxPerCategory: v })}
          />
          <NumberField
            label="Recency window (hours)"
            value={cfg.recencyHours}
            onChange={(v) => patch({ recencyHours: v })}
          />
          <NumberField
            label="Keep articles (days)"
            value={cfg.feedRetentionDays}
            onChange={(v) => patch({ feedRetentionDays: v })}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Boost category</label>
            <select
              className={inputCls}
              value={cfg.boostCategory}
              onChange={(e) => patch({ boostCategory: e.target.value })}
            >
              <option value="">(none)</option>
              {cfg.categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Boost keywords (comma-separated)
            </label>
            <input
              className={inputCls}
              value={cfg.boostKeywords.join(", ")}
              onChange={(e) =>
                patch({ boostKeywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })
              }
              placeholder="e.g. your town, county"
            />
          </div>
        </div>
      </section>

      {/* Categories & feeds */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Categories &amp; feeds</h2>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() => patchCategories([...cfg.categories, { name: "New category", feeds: [] }])}
          >
            <Plus size={16} /> Category
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {cfg.categories.map((cat, ci) => (
            <div key={ci} className="rounded-xl border p-4">
              <div className="mb-3 flex items-center gap-2">
                <input
                  className={inputCls + " font-medium"}
                  value={cat.name}
                  onChange={(e) => {
                    const next = [...cfg.categories];
                    next[ci] = { ...cat, name: e.target.value };
                    patchCategories(next);
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={ci === 0}
                  title="Move up"
                  onClick={() => {
                    const next = [...cfg.categories];
                    [next[ci - 1], next[ci]] = [next[ci]!, next[ci - 1]!];
                    patchCategories(next);
                  }}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={ci === cfg.categories.length - 1}
                  title="Move down"
                  onClick={() => {
                    const next = [...cfg.categories];
                    [next[ci + 1], next[ci]] = [next[ci]!, next[ci + 1]!];
                    patchCategories(next);
                  }}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Remove category"
                  onClick={() => patchCategories(cfg.categories.filter((_, i) => i !== ci))}
                >
                  <Trash size={16} className="text-destructive" />
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {cat.feeds.map((f, fi) => (
                  <div key={fi} className="flex items-center gap-2">
                    <input
                      className={inputCls + " sm:max-w-[180px]"}
                      value={f.name}
                      placeholder="Source name"
                      onChange={(e) => {
                        const next = [...cfg.categories];
                        const feeds = [...cat.feeds];
                        feeds[fi] = { ...f, name: e.target.value };
                        next[ci] = { ...cat, feeds };
                        patchCategories(next);
                      }}
                    />
                    <input
                      className={inputCls}
                      value={f.url}
                      placeholder="https://…/feed"
                      onChange={(e) => {
                        const next = [...cfg.categories];
                        const feeds = [...cat.feeds];
                        feeds[fi] = { ...f, url: e.target.value };
                        next[ci] = { ...cat, feeds };
                        patchCategories(next);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Remove feed"
                      onClick={() => {
                        const next = [...cfg.categories];
                        next[ci] = { ...cat, feeds: cat.feeds.filter((_, i) => i !== fi) };
                        patchCategories(next);
                      }}
                    >
                      <Trash size={16} className="text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start rounded-full"
                  onClick={() => {
                    const next = [...cfg.categories];
                    next[ci] = { ...cat, feeds: [...cat.feeds, { name: "", url: "" }] };
                    patchCategories(next);
                  }}
                >
                  <Plus size={16} /> Feed
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="number"
        className={inputCls}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
