# Market Bubble

Market Bubble is a public, stream-first market dashboard built for the MarketBubble
vibecoding challenge.

Challenge post: https://x.com/MarketBubble/status/2062574325970973093

Production site: https://marketbubble.vercel.app

## Project Goal

The site combines live creator chat, market intelligence, content discovery, and
crypto Twitter context into a single dark, broadcast-style web app. It is designed
to feel like a live trading room rather than a traditional finance dashboard.

Some stream presentation data can be mocked when the referenced creators are not
streaming. This is intentional for the challenge so reviewers can see the full UI
state. The live data paths are implemented and active where public or configured
data sources are available.

This project is for informational and demo purposes only. It is not financial
advice.

## Pages

### Home

The homepage centers the stream experience:

- Stream stage styled like the Market Bubble broadcast frame.
- Live-looking aggregated chat rail.
- Viewer and platform stats.
- Responsive top navigation.
- Twitch popout support on secondary pages.

### Market

The market page is the main intelligence surface:

- Bottom market ticker for BTC, ETH, SOL, HYPE, SPY, QQQ, TSLA, NVDA, AAPL,
  META, and GOLD.
- Global Markets panel with stock indices, crypto, commodities, prices, 24h
  changes, and mini trend charts.
- Clickable asset rows that open a detail modal with chart, description, ticker,
  price context, and news.
- Market Narrative Monitor with switchable TradingView stock and crypto heatmaps.
- News feed with bullish or bearish labels and publisher imagery.
- Smart Money Tracker for Hyperliquid traders, influential portfolios, and top
  Polymarket markets by volume.

### Content

The content page collects Market Bubble media:

- Latest tweets from `@MarketBubble`.
- Clip cards with thumbnails and metadata.
- Popup player for clips and recent stream videos.
- Recent stream list for FaZe Banks-style stream content.
- Scrollable clip rail with hidden scrollbar to preserve the app style.

The content archive can be refreshed without using the paid X API. The repository
includes a GitHub Actions workflow that uses `gallery-dl` to collect public X
metadata and media.

### Community

The community page focuses on live audience activity:

- Large live chat feed for Twitch, Kick, and X activity.
- Hover/focus pauses the chat feed.
- Reuses the homepage stats visual language.
- Shows top 10 chatters with platform logos, message counts, latest message, and
  relative activity bars.
- Stores the top chatter leaderboard server-side when Redis is configured.

Current test channels:

- Twitch: `jynxzi`
- Kick: `solomission`
- X: `MarketBubble`

### Leaderboard

The leaderboard page presents MarketBubble's Top 10 of CT:

- Cobie
- CL
- mert
- threadguy
- jeff
- Mayne
- Flood
- based16z
- jesse
- shoku

Cards use public profile metadata and summarize whether each account currently
appears bullish, bearish, or neutral based on recent public tweets when the
OpenRouter key is configured. Without OpenRouter, the page falls back to a local
keyword-based stance summary.

## Data Sources

The app uses public/free data sources where possible and keeps paid keys optional:

- Yahoo Finance RSS and chart endpoints.
- CoinGecko, Binance, CoinPaprika, and Alternative.me.
- Polymarket Gamma API.
- HyperStats public trader data.
- SEC EDGAR 13F filings.
- TradingView embeddable heatmaps.
- Twitch public GraphQL and IRC websocket data.
- Kick public channel and websocket data, with a known chatroom fallback for the
  `solomission` test channel.
- X/Twitter public scraping through `gallery-dl` for archive updates.
- Massive.com, optionally, for market/news/fundamental enrichment.
- OpenRouter, optionally, for AI summaries and CT stance analysis.
- Upstash Redis, optionally, for shared server-side community top chatter storage.

## Server-Side Top Chatter Storage

The Community page works without server storage, but it becomes shared across
visitors when Vercel Upstash Redis is connected.

Supported Redis env names:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

The store also supports Upstash-native names:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

The API route is:

```text
GET  /api/community-top-chat
POST /api/community-top-chat
```

Chat events are deduped by Twitch/Kick/X message ids before incrementing counts,
so multiple open clients should not multiply the same live message.

## X Content Archive

The workflow at `.github/workflows/update-x-archive.yml` can refresh the content
archive using `gallery-dl`.

Public profile scraping can work without a paid X API. Search-based collection for
posts that tag `@MarketBubble` can require authenticated cookies. If needed, add a
GitHub Actions secret named `X_COOKIES_TXT` containing a Netscape-format
`cookies.txt` export.

Never commit cookies, tokens, API keys, or browser session exports.

## Environment Variables

Create `.env.local` for local development. Do not commit it.

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional market/news enrichment
MASSIVE_API_KEY=your_massive_key_here

# Optional AI summaries
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=x-ai/grok-4.3

# Optional shared Community top chatter storage
KV_REST_API_URL=your_vercel_upstash_rest_url
KV_REST_API_TOKEN=your_vercel_upstash_rest_token
```

In production, set secrets in Vercel project environment variables. Do not put
real keys in source control.

## Local Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful scripts:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Deployment

The app is deployed on Vercel:

```bash
vercel --prod
```

Production should have these configured in Vercel:

- `NEXT_PUBLIC_SITE_URL`
- `MASSIVE_API_KEY` if Massive-backed data is desired.
- `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` if AI summaries are desired.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` for shared Community top chatter
  storage.

## Security

- `.env*`, `.vercel`, `.next`, `node_modules`, build output, and logs are ignored.
- API keys and cookies must stay in local or hosting-provider environment
  variables.
- Public API routes sanitize handles, channel names, asset ids, links, and media
  URLs before calling upstream providers.
- The repository should contain placeholders only, never real API keys.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- CSS Modules and global CSS
- Vercel Functions
- Upstash Redis through Vercel env vars
- `react-icons`
- `fast-xml-parser`

## License

MIT. See `LICENSE`.
