"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  ArrowsClockwise,
  Sun,
  Moon,
  Newspaper,
  SignOut,
  GearSix,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DEFAULT_CATEGORIES, type Article, type Feed, type Reaction, type Reactions } from "@/lib/types";
import { applyTheme } from "@/lib/theme";

const POLL_MS = 5 * 60 * 1000;

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function Page() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [reactions, setReactions] = useState<Reactions>({});
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [category, setCategory] = useState<string>("All");
  const [likedOnly, setLikedOnly] = useState(false);
  const [hideDisliked, setHideDisliked] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterReady, setFilterReady] = useState(false);
  const [mobileArticle, setMobileArticle] = useState(false); // mobile: show reading pane
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Theme: restore preference, default to dark (easier on the eyes in the car at night).
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved ? saved === "dark" : true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // Load categories + theme from config.json (customizable in Settings).
  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!cfg) return;
        if (Array.isArray(cfg.categories) && cfg.categories.length > 0) {
          setCategories(cfg.categories.map((c: { name: string }) => c.name));
        }
        if (cfg.theme) applyTheme(cfg.theme);
      })
      .catch(() => {});
  }, []);

  // Restore the selected category filter, then persist it on change.
  useEffect(() => {
    const saved = localStorage.getItem("category");
    if (saved) setCategory(saved);
    setFilterReady(true);
  }, []);
  useEffect(() => {
    if (!filterReady) return;
    localStorage.setItem("category", category);
  }, [category, filterReady]);

  // Scroll the article list back to the top when the filter changes.
  useEffect(() => {
    sidebarRef.current?.scrollTo({ top: 0 });
  }, [category, likedOnly, hideDisliked]);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      setFeed(await res.json());
    } catch {
      /* keep prior feed on transient error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
    fetch("/api/reactions", { cache: "no-store" })
      .then((r) => r.json())
      .then(setReactions)
      .catch(() => {});
    const id = setInterval(loadFeed, POLL_MS);
    return () => clearInterval(id);
  }, [loadFeed]);

  const react = useCallback((id: string, next: Reaction) => {
    setReactions((prev) => {
      const cur = { ...prev };
      const value: Reaction | null = cur[id] === next ? null : next;
      if (value === null) delete cur[id];
      else cur[id] = value;
      fetch("/api/reactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, reaction: value }),
      }).catch(() => {});
      return cur;
    });
  }, []);

  const articles = feed?.articles ?? [];

  const filters = useMemo(() => ["All", ...categories], [categories]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: articles.length };
    for (const cat of categories) c[cat] = 0;
    for (const a of articles) c[a.category] = (c[a.category] ?? 0) + 1;
    return c;
  }, [articles, categories]);

  const filtered = useMemo(
    () =>
      articles
        .filter((a) => {
          if (category !== "All" && a.category !== category) return false;
          const r = reactions[a.id];
          if (likedOnly && r !== "up") return false;
          if (hideDisliked && !likedOnly && r === "down") return false;
          return true;
        })
        // Newest-posted first, interleaving categories (not grouped).
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [articles, category, reactions, likedOnly, hideDisliked],
  );

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top header: brand + category filter + actions */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 md:flex-nowrap md:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Newspaper size={26} weight="fill" className="text-primary" />
          <span className="text-xl font-semibold tracking-tight">WattsNew</span>
        </div>

        <div className="order-last w-full overflow-x-auto md:order-none md:w-auto md:min-w-0 md:flex-1">
          <div className="flex items-center gap-2 py-1">
            {filters.map((f) => (
              <Button
                key={f}
                size="lg"
                variant={category === f ? "default" : "outline"}
                className="shrink-0 rounded-full text-xl tracking-wide [font-variant:small-caps]"
                onClick={() => setCategory(f)}
              >
                {f}
                <span
                  className={cn(
                    "ml-1.5 [font-variant:normal]",
                    category === f ? "text-primary-foreground" : "text-primary",
                  )}
                >
                  {counts[f] ?? 0}
                </span>
              </Button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <Button
            size="lg"
            variant={likedOnly ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setLikedOnly((v) => !v)}
            title="Show only liked articles"
          >
            <ThumbsUp size={20} weight={likedOnly ? "fill" : "regular"} />
            <span className="hidden lg:inline">Liked</span>
          </Button>
          <Button
            size="lg"
            variant={hideDisliked ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setHideDisliked((v) => !v)}
            title="Hide articles you marked not interested"
          >
            <ThumbsDown size={20} weight={hideDisliked ? "fill" : "regular"} />
            <span className="hidden lg:inline">Hide</span>
          </Button>
          <Button size="icon-lg" variant="ghost" onClick={loadFeed} title="Refresh">
            <ArrowsClockwise size={20} />
          </Button>
          <Button size="icon-lg" variant="ghost" asChild title="Settings">
            <Link href="/settings">
              <GearSix size={20} />
            </Link>
          </Button>
          <Button
            size="icon-lg"
            variant="ghost"
            onClick={() => setDark((v) => !v)}
            title="Toggle light / dark"
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </Button>
          <Button
            size="icon-lg"
            variant="ghost"
            onClick={async () => {
              await fetch("/api/logout", { method: "POST" }).catch(() => {});
              window.location.href = "/login";
            }}
            title="Sign out"
          >
            <SignOut size={20} />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left sidebar: list of articles. On mobile it's full-width and hidden
            while reading; on md+ it's a fixed column shown alongside the pane. */}
        <aside
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-r bg-sidebar md:flex md:w-[340px]",
            mobileArticle ? "hidden" : "flex",
          )}
        >
          <div ref={sidebarRef} className="flex-1 overflow-y-auto">
            <ul className="divide-y">
              {filtered.map((a) => (
                <ArticleRow
                  key={a.id}
                  article={a}
                  reaction={reactions[a.id]}
                  active={selected?.id === a.id}
                  onSelect={() => {
                    setSelectedId(a.id);
                    setMobileArticle(true);
                  }}
                />
              ))}
              {filtered.length === 0 && (
                <li className="p-6 text-center text-muted-foreground">
                  {loading
                    ? "Loading…"
                    : "No articles to show. The next update runs at 8am or 6pm."}
                </li>
              )}
            </ul>
          </div>
          <div className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground">
            {feed && feed.articles.length > 0
              ? `Updated ${relativeTime(feed.generatedAt)} · ${filtered.length} shown`
              : "Waiting for first update"}
          </div>
        </aside>

        {/* Main reading pane. Hidden on mobile until an article is opened. */}
        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 md:flex md:flex-col",
            mobileArticle ? "flex flex-col" : "hidden",
          )}
        >
          {selected ? (
            <ReadingPane
              article={selected}
              reaction={reactions[selected.id]}
              onReact={react}
              onBack={() => setMobileArticle(false)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-10 text-center text-muted-foreground">
              <p className="max-w-md text-lg">
                {loading
                  ? "Loading the latest news…"
                  : "Pick an article from the list to read it."}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ArticleRow({
  article,
  reaction,
  active,
  onSelect,
}: {
  article: Article;
  reaction?: Reaction;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          "flex min-h-[150px] w-full flex-col justify-center gap-2 px-4 py-6 text-left transition-colors",
          active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
        )}
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="shrink-0 text-lg">
            {article.category}
          </Badge>
          {reaction === "up" && <ThumbsUp size={24} weight="fill" className="text-primary" />}
          {reaction === "down" && (
            <ThumbsDown size={24} weight="fill" className="text-muted-foreground" />
          )}
          <span className="ml-auto shrink-0 text-lg text-muted-foreground">
            {relativeTime(article.publishedAt)}
          </span>
        </div>
        <p className="line-clamp-3 text-xl font-medium leading-snug">{article.title}</p>
        <span className="text-lg text-muted-foreground">{article.source}</span>
      </button>
    </li>
  );
}

function ReadingPane({
  article,
  reaction,
  onReact,
  onBack,
}: {
  article: Article;
  reaction?: Reaction;
  onReact: (id: string, r: Reaction) => void;
  onBack: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-load the full article text whenever a different article is selected,
  // and snap the reading lane back to the top.
  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setImage(null);
    setStatus("loading");
    scrollRef.current?.scrollTo({ top: 0 });
    (async () => {
      try {
        const res = await fetch(`/api/article?url=${encodeURIComponent(article.url)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.content) throw new Error(data.error || "failed");
        setContent(data.content as string);
        setImage((data.image as string | null) ?? null);
        setStatus("idle");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [article.id, article.url]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {/* Mobile-only sticky close button (upper-right) — stays visible while
          scrolling the article so there's always a way back to the list.
          Desktop shows the list alongside, so it doesn't need one. */}
      <div className="sticky top-0 z-10 flex justify-end px-2 py-2 md:hidden">
        <Button
          variant="secondary"
          size="icon-lg"
          className="rounded-full shadow-sm"
          onClick={onBack}
          title="Close — back to list"
          aria-label="Back to list"
        >
          <X size={24} weight="bold" />
        </Button>
      </div>
      <article className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <div className="mb-4 flex items-center gap-3">
          <Badge className="text-sm">{article.category}</Badge>
          <span className="text-base text-muted-foreground">
            {article.source} · {relativeTime(article.publishedAt)}
          </span>
        </div>

        <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight">
          {article.title}
        </h1>

        {!content && (
          <p className="mt-6 text-[1.7rem] leading-[1.75] text-foreground/90">{article.summary}</p>
        )}

        {status === "loading" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowsClockwise size={16} className="animate-spin" />
            Loading full article…
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              variant={reaction === "up" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => onReact(article.id, "up")}
              title="I liked this"
            >
              <ThumbsUp size={22} weight={reaction === "up" ? "fill" : "regular"} />
              Like
            </Button>
            <Button
              size="lg"
              variant={reaction === "down" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => onReact(article.id, "down")}
              title="Not interested"
            >
              <ThumbsDown size={22} weight={reaction === "down" ? "fill" : "regular"} />
              Not interested
            </Button>
          </div>
        </div>

        {status === "error" && (
          <p className="mt-6 text-sm text-muted-foreground">
            Couldn&rsquo;t load the full article in the reader (the source may block it).{" "}
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Open the original
            </a>
            .
          </p>
        )}

        {content && (
          <div className="mt-8 border-t pt-8">
            {image && !content.includes("<img") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                className="mb-6 w-full rounded-xl border object-cover"
              />
            )}
            <div className="article-content" dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        )}
      </article>
    </div>
  );
}
