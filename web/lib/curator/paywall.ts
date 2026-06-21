/**
 * Domains known to put articles behind a metered / subscriber paywall.
 * Even though our sources are chosen to be free, aggregator feeds (Hacker News,
 * Google News, etc.) can link out to paywalled outlets — so we filter by host.
 */
const PAYWALL_DOMAINS = new Set([
  "nytimes.com",
  "wsj.com",
  "ft.com",
  "bloomberg.com",
  "washingtonpost.com",
  "theinformation.com",
  "economist.com",
  "newyorker.com",
  "theatlantic.com",
  "wired.com",
  "businessinsider.com",
  "insider.com",
  "seekingalpha.com",
  "medium.com",
  "hbr.org",
  "foreignpolicy.com",
  "latimes.com",
  "thetimes.co.uk",
  "telegraph.co.uk",
  "nationalgeographic.com",
  "newscientist.com",
  "barrons.com",
  "forbes.com",
]);

export function isPaywalled(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  if (PAYWALL_DOMAINS.has(host)) return true;
  // Match subdomains too (e.g. eu.nytimes.com).
  return [...PAYWALL_DOMAINS].some((d) => host === d || host.endsWith("." + d));
}
