export interface FeedSource {
  name: string;
  url: string;
}
export interface CategoryConfig {
  name: string;
  feeds: FeedSource[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Serialize categories → OPML 2.0 (categories as nested outlines). */
export function toOPML(categories: CategoryConfig[], title = "Daily News"): string {
  const body = categories
    .map((c) => {
      const feeds = c.feeds
        .map(
          (f) =>
            `      <outline type="rss" text="${esc(f.name)}" title="${esc(f.name)}" xmlUrl="${esc(f.url)}"/>`,
        )
        .join("\n");
      return `    <outline text="${esc(c.name)}" title="${esc(c.name)}">\n${feeds}\n    </outline>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>${esc(title)}</title>\n  </head>\n  <body>\n${body}\n  </body>\n</opml>\n`;
}

/** Parse OPML → categories. Nested outlines become categories; top-level feed
 *  outlines (no children) are grouped under an "Imported" category. */
export function fromOPML(xml: string): CategoryConfig[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("Could not parse OPML file");
  const body = doc.querySelector("body");
  if (!body) return [];

  const cats: CategoryConfig[] = [];
  const loose: FeedSource[] = [];

  for (const node of Array.from(body.children)) {
    if (node.tagName.toLowerCase() !== "outline") continue;
    const label = node.getAttribute("text") || node.getAttribute("title") || "";
    const xmlUrl = node.getAttribute("xmlUrl");

    if (xmlUrl) {
      loose.push({ name: label || xmlUrl, url: xmlUrl });
      continue;
    }
    const feeds: FeedSource[] = [];
    for (const child of Array.from(node.children)) {
      const url = child.getAttribute("xmlUrl");
      if (url) feeds.push({ name: child.getAttribute("text") || child.getAttribute("title") || url, url });
    }
    cats.push({ name: label || "Untitled", feeds });
  }

  if (loose.length) cats.push({ name: "Imported", feeds: loose });
  return cats;
}
