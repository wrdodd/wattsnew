import { extractFromHtml, addTransformations } from "@extractus/article-extractor";
import { readFeed } from "@/lib/data";
import { isAuthed, unauthorized } from "@/lib/auth";
import { fetchRenderedHtml } from "@/lib/browser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Valnet CMS sites (Collider, ScreenRant, GameRant, MovieWeb, CBR, TheGamer…)
// inject "<Site> Exclusive" quiz widgets and author byline/bio/sign-in blocks
// that fool the readability heuristic — on short articles the quiz text blob
// gets extracted INSTEAD of the article. Scope extraction to the real
// #article-body container and strip the injected widgets so only the article
// survives. No-op on pages without that container, so it's safe.
const VALNET_JUNK = [
  ".sensa-widget-container",
  ".cq-quiz",
  '[class^="cq-"]',
  '[class*=" cq-"]',
  ".tag-interaction-widget",
  ".trending-now",
  ".w-hub-widgets",
  ".related-articles",
  '[class*="newsletter"]',
  '[class*="recirc"]',
  "aside",
  "figure.related",
  ".gallery-cta",
].join(", ");

addTransformations({
  patterns: [
    /collider\.com/,
    /screenrant\.com/,
    /gamerant\.com/,
    /movieweb\.com/,
    /cbr\.com/,
    /thegamer\.com/,
    /makeuseof\.com/,
  ],
  pre: (document) => {
    const body =
      document.querySelector("#article-body") || document.querySelector(".article-body");
    if (body) {
      body.querySelectorAll(VALNET_JUNK).forEach((el) => el.remove());
      const docBody = document.querySelector("body");
      if (docBody) docBody.innerHTML = body.outerHTML;
    }
    return document;
  },
});

const FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

// Detect when extraction actually parsed a block / bot-wall page (Akamai,
// Cloudflare, etc.) instead of the real article.
function looksBlocked(title: string, content: string): boolean {
  const text = `${title} ${content}`.replace(/<[^>]+>/g, " ").toLowerCase();
  return (
    text.includes("you don't have permission") ||
    text.includes("access denied") ||
    text.includes("errors.edgesuite.net") ||
    text.includes("request unsuccessful") ||
    text.includes("attention required") ||
    text.includes("enable javascript and cookies") ||
    text.includes("verifying you are human") ||
    /reference #\d/.test(text)
  );
}

// Promote lazy-loaded image URLs (data-src / data-lazy-src / srcset) into the
// real `src` so images render instead of showing as blank gaps (e.g. NASA).
function unlazyImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const lazy = tag.match(
      /\b(?:data-src|data-lazy-src|data-original|data-lazy)\s*=\s*["']([^"']+)["']/i,
    )?.[1];
    const srcset = tag.match(/\b(?:data-srcset|srcset)\s*=\s*["']([^"']+)["']/i)?.[1];
    let chosen = lazy;
    if (!chosen && srcset) {
      const urls = srcset
        .split(",")
        .map((s) => s.trim().split(/\s+/)[0])
        .filter(Boolean);
      chosen = urls[urls.length - 1]; // largest in srcset
    }
    if (!chosen) return tag;
    return /\bsrc\s*=\s*["'][^"']*["']/i.test(tag)
      ? tag.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${chosen}"`)
      : tag.replace(/<img\b/i, `<img src="${chosen}"`);
  });
}

// The page's social/preview image — usually the article's hero photo.
function ogImage(html: string, base: string): string | undefined {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (!m?.[1]) return undefined;
  try {
    return new URL(m[1], base).toString();
  } catch {
    return m[1];
  }
}

// Drop author-avatar images (e.g. gravatar) that readability sometimes keeps.
function stripAvatars(content: string): string {
  return content.replace(/<img[^>]*(?:gravatar|\/avatar)[^>]*>/gi, "");
}

export async function GET(request: Request) {
  if (!isAuthed(request)) return unauthorized();
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return Response.json({ error: "url required" }, { status: 400 });

  // SSRF guard: only fetch URLs that actually appear in the current feed.
  const feed = await readFeed();
  if (!feed.articles.some((a) => a.url === url)) {
    return Response.json({ error: "unknown url" }, { status: 403 });
  }

  let article: { title?: string; content?: string; author?: string; published?: string } | null =
    null;
  let image: string | undefined;

  // 1) Fast path: fetch raw HTML, promote lazy images, extract.
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const html = await res.text();
      image = ogImage(html, url);
      article = await extractFromHtml(unlazyImages(html), url);
    }
  } catch {
    /* fall through to headless */
  }

  // 2) Fallback: render in headless Chromium for outlets that block server fetches.
  if (!article?.content) {
    try {
      const html = await fetchRenderedHtml(url);
      image = image ?? ogImage(html, url);
      article = await extractFromHtml(unlazyImages(html), url);
    } catch (err) {
      return Response.json(
        { error: `could not extract article: ${String(err).slice(0, 160)}` },
        { status: 502 },
      );
    }
  }

  if (!article?.content) {
    return Response.json({ error: "could not extract article" }, { status: 502 });
  }
  if (looksBlocked(article.title ?? "", article.content)) {
    return Response.json({ error: "source blocked extraction" }, { status: 502 });
  }
  return Response.json({
    title: article.title ?? "",
    content: stripAvatars(article.content),
    image: image ?? null,
    author: article.author ?? "",
    published: article.published ?? "",
  });
}
