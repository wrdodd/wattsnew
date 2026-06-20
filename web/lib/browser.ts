import puppeteer, { type Browser } from "puppeteer-core";

// Some outlets (KGW/TEGNA, KOIN/Nexstar) block server-side fetches with a 403
// regardless of headers. A real headless Chromium renders them like a browser.
// One browser instance is kept alive and reused across requests.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let browserPromise: Promise<Browser> | null = null;

function launch(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = launch();
  let browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = launch();
    browser = await browserPromise;
  }
  return browser;
}

/** Render a page in headless Chromium and return its full HTML. */
export async function fetchRenderedHtml(url: string): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(UA);
    await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1200)); // let late content settle
    return await page.content();
  } finally {
    await page.close().catch(() => {});
  }
}
