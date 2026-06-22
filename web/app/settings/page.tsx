"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  FloppyDisk,
  ArrowLeft,
  DownloadSimple,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { applyTheme } from "@/lib/theme";
import { toOPML, fromOPML } from "@/lib/opml";

interface FeedSource {
  name: string;
  url: string;
}
interface CategoryConfig {
  name: string;
  feeds: FeedSource[];
  query?: string;
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
  const [searxngEnabled, setSearxngEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState<{ username: string; role: string } | null>(null);
  const [users, setUsers] = useState<{ username: string; role: string; createdAt: string }[]>([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" });
  const [newPassword, setNewPassword] = useState("");
  const [acctMsg, setAcctMsg] = useState("");
  const isAdmin = account?.role === "admin";

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((j) => {
        setCfg(j);
        setSearxngEnabled(!!j?.searxngEnabled);
      })
      .catch(() => {});
  }, []);

  async function refreshUsers() {
    const r = await fetch("/api/users", { cache: "no-store" });
    if (r.ok) setUsers(await r.json());
  }

  useEffect(() => {
    fetch("/api/account", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        setAccount(a);
        if (a?.role === "admin") refreshUsers();
      })
      .catch(() => {});
  }, []);

  async function changePassword() {
    setAcctMsg("");
    const r = await fetch("/api/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (r.ok) {
      setNewPassword("");
      setAcctMsg("Password updated");
    } else {
      setAcctMsg((await r.json().catch(() => ({})))?.error || "Failed");
    }
  }

  async function addUserHandler() {
    setAcctMsg("");
    const r = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (r.ok) {
      setUsers(await r.json());
      setNewUser({ username: "", password: "", role: "user" });
    } else {
      setAcctMsg((await r.json().catch(() => ({})))?.error || "Failed");
    }
  }

  async function deleteUserHandler(username: string) {
    const r = await fetch(`/api/users?username=${encodeURIComponent(username)}`, { method: "DELETE" });
    if (r.ok) setUsers(await r.json());
  }

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

  function exportOPML() {
    if (!cfg) return;
    const blob = new Blob([toOPML(cfg.categories)], { type: "text/x-opml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wattsnew.opml";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importOPML(file: File) {
    setError("");
    try {
      const cats = fromOPML(await file.text());
      if (cats.length === 0) {
        setError("No feeds found in that OPML file");
        setStatus("error");
        return;
      }
      patchCategories(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "import failed");
      setStatus("error");
    }
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
          {isAdmin && status === "saved" && <span className="text-sm text-primary">Saved</span>}
          {isAdmin && status === "error" && (
            <span className="text-sm text-destructive">{error}</span>
          )}
          {isAdmin && (
            <Button size="lg" className="rounded-full" onClick={save} disabled={status === "saving"}>
              <FloppyDisk size={18} />
              {status === "saving" ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </header>

      {/* Account (everyone) */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Account</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">{account?.username ?? "…"}</span>
          {isAdmin ? " (admin)" : ""}.
        </p>
        <label className="mb-1 block text-sm font-medium">Change your password</label>
        <div className="flex max-w-md gap-2">
          <input
            type="password"
            className={inputCls}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
          />
          <Button
            variant="outline"
            className="shrink-0 rounded-full"
            onClick={changePassword}
            disabled={newPassword.length < 4}
          >
            Update
          </Button>
        </div>
        {acctMsg && <p className="mt-2 text-sm text-primary">{acctMsg}</p>}
      </section>

      {/* Users (admin only) */}
      {isAdmin && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Users</h2>
          <ul className="mb-4 divide-y overflow-hidden rounded-xl border">
            {users.map((u) => (
              <li key={u.username} className="flex items-center justify-between px-4 py-2">
                <span>
                  {u.username}{" "}
                  <span className="text-sm text-muted-foreground">({u.role})</span>
                </span>
                {u.username !== account?.username && (
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Remove user"
                    onClick={() => deleteUserHandler(u.username)}
                  >
                    <Trash size={16} className="text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <label className="mb-1 block text-sm font-medium">Add user</label>
          <div className="flex flex-wrap gap-2">
            <input
              className={inputCls + " sm:max-w-[180px]"}
              value={newUser.username}
              placeholder="username"
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            />
            <input
              type="password"
              className={inputCls + " sm:max-w-[180px]"}
              value={newUser.password}
              placeholder="password"
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
            <select
              className={inputCls + " sm:max-w-[130px]"}
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <Button
              variant="outline"
              className="shrink-0 rounded-full"
              onClick={addUserHandler}
              disabled={!newUser.username.trim() || newUser.password.length < 4}
            >
              <Plus size={16} /> Add
            </Button>
          </div>
        </section>
      )}

      {!isAdmin && (
        <p className="mb-8 text-sm text-muted-foreground">
          Only admins can change feeds, categories, and appearance.
        </p>
      )}

      {isAdmin && (
        <p className="mb-8 text-sm text-muted-foreground">
          Feed and category changes apply on the next scheduled curation run. Theme changes apply
          immediately.
        </p>
      )}

      {/* Theme */}
      {isAdmin && (
        <>
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
        <div className="mb-4 rounded-lg border p-3 text-sm">
          <span className="font-medium">Web search (SearXNG): </span>
          {searxngEnabled ? (
            <>
              <span className="text-primary">Connected.</span> Each category can pull extra fresh
              news from your SearXNG instance — set a <strong>search query</strong> per category in{" "}
              <span className="font-medium">Categories &amp; feeds</span> below.
            </>
          ) : (
            <span className="text-muted-foreground">
              Not configured. Set <code className="rounded bg-muted px-1">SEARXNG_URL</code> on the
              server to augment feeds with web-search news, then add a query per category below.
            </span>
          )}
        </div>
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

      {/* Import / Export */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Import / Export (OPML)</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Back up your feeds, or bring subscriptions from another reader. Importing replaces the
          categories below — review, then Save.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={exportOPML}>
            <DownloadSimple size={18} /> Export OPML
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => fileRef.current?.click()}
          >
            <UploadSimple size={18} /> Import OPML
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".opml,.xml,text/xml,text/x-opml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importOPML(f);
              e.target.value = "";
            }}
          />
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
        <p className="mb-3 text-sm text-muted-foreground">
          Each category pulls from its RSS feeds. If your server has{" "}
          <code className="rounded bg-muted px-1">SEARXNG_URL</code> set (a self-hosted{" "}
          <a
            href="https://docs.searxng.org/"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            SearXNG
          </a>{" "}
          with JSON enabled), the optional <strong>search query</strong> below adds fresh web-search
          news to the mix for that category.
        </p>

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

              <input
                className={inputCls + " mb-3 text-sm"}
                value={cat.query ?? ""}
                placeholder="SearXNG search query (optional) — e.g. &quot;artificial intelligence&quot;"
                onChange={(e) => {
                  const next = [...cfg.categories];
                  next[ci] = { ...cat, query: e.target.value };
                  patchCategories(next);
                }}
              />

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
        </>
      )}
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
