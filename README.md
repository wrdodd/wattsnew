# WattsNew

**A self-hosted, text-first news reader — built for the Tesla browser first,
then refined for phone and desktop.**

WattsNew started life on the big center screen of a Tesla Model Y: large type,
generous tap targets, and a clean two-pane layout meant to be read while parked
or charging. It works just as well on a phone or laptop. A background worker
curates fresh articles from RSS feeds across categories (AI, Tech, Science,
Business, Gaming, Politics, Entertainment, Local…) on a schedule; the web reader
lets you browse by category, read full articles in-place, and thumbs-up/down
stories to tune what you see.

- 🚗 **Tesla-first, everywhere-friendly** — designed for the in-car browser
  (large type, big tap targets, two-pane reading), then refined for phones and
  desktop.
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
git clone https://github.com/OWNER/wattsnew.git
cd wattsnew
cp .env.example .env          # set DASHBOARD_PASSWORD (and anything else)
docker compose up -d --build  # → http://localhost:8080
```

Log in with the `DASHBOARD_USER` / `DASHBOARD_PASSWORD` from your `.env`.

> 💡 **Tip: set it up from a computer first.** The in-app **Settings** page
> (feeds, categories, counts, theme) is much easier to configure with a
> full-size keyboard and screen. Get your feeds and look dialed in on a laptop
> or desktop, then just open the same URL on your Tesla or phone to read — all
> settings live on the server, so every device sees the same configuration.

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
| `LLM_PROVIDER` | `none` | `none` \| `anthropic` \| `openai` for summaries |

Everything else — **feeds, categories, per-category counts, recency/retention,
keyword boosting, accent color, and reading size** — is configured in the in-app
**Settings** page (⚙️ in the header) and stored in `config.json` on the data
volume. No rebuild needed.

### Customizing feeds

Open **Settings** (easiest from a computer — see the tip above) → add/remove/reorder
categories and feeds, set per-category counts, pick a boost category + keywords
(e.g. your town for "Local"), and choose the accent color and reading size.
Changes to feeds apply on the next curation run; theme changes apply immediately.
You can also import/export your feed list as OPML, or edit `config.json` directly.

## Putting it behind a domain name (recommended)

Out of the box WattsNew listens on `http://<host>:8080`. For day-to-day use —
especially from a Tesla or phone — it's much nicer behind your own domain with
HTTPS (e.g. `https://news.example.com`). Put a reverse proxy in front of it.

WattsNew is reverse-proxy-aware: when it sees an HTTPS request (via the
`X-Forwarded-Proto` header), the session cookie is automatically marked
`Secure`. So just forward that header and you get hardened cookies for free.

**nginx** example (after pointing your domain's DNS at the host and issuing a
cert, e.g. with [certbot](https://certbot.eff.org/)):

```nginx
server {
    listen 443 ssl;
    server_name news.example.com;

    ssl_certificate     /etc/letsencrypt/live/news.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/news.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;   # or the container's LAN IP
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # enables Secure cookies
    }
}

# Redirect plain HTTP → HTTPS
server {
    listen 80;
    server_name news.example.com;
    return 301 https://$host$request_uri;
}
```

Run one server block per domain if you host multiple readers. Prefer something
turnkey? [Caddy](https://caddyserver.com/) does the same with automatic HTTPS in
two lines:

```caddy
news.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

(Caddy sets `X-Forwarded-Proto` automatically, so Secure cookies just work.)

## Roadmap

- [x] **Config-driven feeds/categories** via `config.json` + an in-app Settings UI
- [x] **Theme settings** (accent color, font-size presets) in the UI
- [x] **OPML import/export**
- [x] **Mobile/responsive layout** (master-detail on phones)
- [x] Prebuilt images on GHCR + GitHub Actions CI
- [x] **Multiple users** — per-user logins & reactions; admin-managed accounts
- [ ] Read/unread, search, save-for-later
- [ ] PWA install

## Deploying to a remote Docker host

Point your Docker CLI at the host (e.g. an SSH context) and run compose there:

```bash
docker context create myhost --docker "host=ssh://user@your-host"
docker --context myhost compose up -d --build
```

## License

[MIT](LICENSE).
