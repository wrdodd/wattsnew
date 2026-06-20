# Daily News

A **self-hosted, text-first news reader.** A background worker curates fresh
articles from RSS feeds across categories (AI, Tech, Science, Business, Gaming,
Politics, Entertainment, Local…) on a schedule; a clean web reader lets you
browse by category, read full articles in-place, and thumbs-up/down stories to
tune what you see.

- 🔒 **Fully self-hosted & private** — no tracking, no third-party services. Runs
  on your own machine in two Docker containers.
- 🧠 **No AI required** — summaries come straight from the feeds. Optionally plug
  in Claude or OpenAI for nicer summaries.
- 📖 **Read in-place** — the reader extracts the full article (with images), so
  you rarely leave the app. Headless-browser fallback for stubborn sites.
- 👍 **Personalized** — your reactions boost sources you like and bury ones you
  don't, with per-category source diversity.
- ♿ **Text-first & accessible** — built for comfortable reading: large adjustable
  type, light/dark, keyboard-friendly.

> Status: early but fully working. See the [Roadmap](#roadmap).

## Quick start

Requires Docker.

```bash
git clone https://github.com/OWNER/daily-news.git
cd daily-news
cp .env.example .env          # set DASHBOARD_PASSWORD (and anything else)
docker compose up -d --build  # → http://localhost:8080
```

Log in with the `DASHBOARD_USER` / `DASHBOARD_PASSWORD` from your `.env`.

## How it works

```
   RSS feeds ──▶  worker  ──(writes)──▶  /data  ──(reads)──▶  web  ──▶  you
 (per category)   fetch · filter ·     feed.json            Next.js
                  dedup · rank ·       reactions.json       reader
                  summarize
```

- **worker** — fetches each category's feeds, drops paywalled/duplicate/old
  items, ranks (recency + your reactions + optional keyword boost), and writes
  `feed.json`. Runs on a cron schedule.
- **web** — a Next.js app serving the feed, the in-place article reader, and the
  reaction API. Guarded by a single login.
- Both share one Docker volume (`/data`).

## Configuration

All via environment variables (see [`.env.example`](.env.example)):

| Variable | Default | What it does |
|---|---|---|
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | `admin` / — | Login credentials |
| `AUTH_SECRET` | auto-generated | Session-cookie signing key (persisted to `/data` if unset) |
| `WEB_PORT` | `8080` | Host port for the reader |
| `CRON` | `0 8,18 * * *` | Curation schedule (cron) |
| `TZ` / `TIMEZONE` | `America/New_York` | Timezone for the schedule |
| `MAX_PER_CATEGORY` | `10` | Articles added per category per run |
| `RECENCY_HOURS` | `48` | Max age for a "new" article |
| `FEED_RETENTION_DAYS` | `7` | How long articles stay before aging out |
| `BOOST_CATEGORY` / `BOOST_KEYWORDS` | `Local` / — | Float keyword matches (e.g. your town) to the top of one category |
| `LLM_PROVIDER` | `none` | `none` \| `anthropic` \| `openai` for summaries |

### Customizing feeds

For now, categories and feeds live in
[`worker/src/sources.ts`](worker/src/sources.ts) — edit the list and rebuild the
worker. A `config.json` + in-app **Settings UI** (no rebuild needed) is the next
milestone — see the Roadmap.

## Roadmap

- [ ] **Config-driven feeds/categories** via `config.json` + an in-app Settings UI
- [ ] **Multiple users** (per-user logins, reactions, preferences)
- [ ] **Theme settings** (accent color, font-size presets) in the UI
- [ ] **OPML import/export**
- [ ] **Mobile/responsive layout** & PWA
- [ ] Read/unread, search, save-for-later
- [ ] Prebuilt images on GHCR + GitHub Actions CI

## Deploying to a remote Docker host

Point your Docker CLI at the host (e.g. an SSH context) and run compose there:

```bash
docker context create myhost --docker "host=ssh://user@your-host"
docker --context myhost compose up -d --build
```

## License

[MIT](LICENSE).
