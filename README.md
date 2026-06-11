<div align="center">
  <h1>Market Bubble</h1>

  <p>
    <strong>Live stream intelligence for crypto, markets, prediction markets, and creator chat.</strong>
  </p>

  <p>
    <a href="https://marketbubble.vercel.app"><strong>Live App</strong></a>
    &nbsp;&middot;&nbsp;
    <a href="https://marketbubble.vercel.app/watch"><strong>Watch Dashboard</strong></a>
    &nbsp;&middot;&nbsp;
    <a href="#obs-overlays"><strong>OBS Overlays</strong></a>
    &nbsp;&middot;&nbsp;
    <a href="#watch-dashboard"><strong>Features</strong></a>
    &nbsp;&middot;&nbsp;
    <a href="#local-development"><strong>Run Locally</strong></a>
  </p>

  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-111111?style=for-the-badge&logo=nextdotjs&logoColor=white" />
    <img alt="React" src="https://img.shields.io/badge/React-19-1c1c1c?style=for-the-badge&logo=react&logoColor=61DAFB" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Ready-1c1c1c?style=for-the-badge&logo=typescript&logoColor=3178C6" />
    <img alt="Vercel" src="https://img.shields.io/badge/Vercel-Deployed-111111?style=for-the-badge&logo=vercel&logoColor=white" />
  </p>
</div>

<p align="center">
  <a href="./public/readme/watch-demo.mp4">
    <img src="./public/readme/watch-demo-preview.gif" alt="Watch dashboard demo animation" width="100%" />
  </a>
</p>

<p align="center">
  <a href="./public/readme/watch-demo.mp4"><strong>Open the full MP4 demo</strong></a>
</p>

---

Market Bubble is a stream-first market intelligence app for crypto, finance,
prediction markets, and live creator communities. It combines live video,
aggregated chat, market context, sentiment, news, and social feeds into a dark
broadcast dashboard built with Next.js.

This project is for informational and demo purposes only. It is not financial
advice.

## What It Does

Market Bubble is designed to feel like a live trading room instead of a static
finance website. The app watches creator streams and social feeds, aggregates
Twitch, Kick, and X activity, highlights tickers and cashtags, tracks audience
sentiment, and surfaces the market context around what the community is talking
about.

The current Watch page is configured with public test streams so the dashboard
has live data during development and review. The same adapters, collectors, and
UI flows are built for Banks and Ansem's platforms across Twitch, Kick, and X.
Point the configured Twitch channels, Kick slugs, X handles, and X broadcast
URLs at the live Banks/Ansem sources and the dashboard works against those
streams instead of the test streams.

## Signal Stack

| Surface | What it shows |
| --- | --- |
| **Watch** | Stream embed, aggregated Twitch/Kick/X chat, live stats, sentiment, top words, news, and Polymarket. |
| **Market** | Global markets, ticker context, asset detail modals, heatmaps, news, and smart-money views. |
| **Chat Intelligence** | First-time chatters, top chatters, ticker cards, emotes, search, persistence, and platform filters. |
| **Collectors** | Optional Twitch, Kick, and X ingestion paths for production-grade live community data. |
| **Fallbacks** | Public/browser data paths keep the dashboard usable without paid API access. |

## Pages

### Home

The homepage is the main branded entry point for Market Bubble.

- Stream-first layout with the Market Bubble visual style.
- Live-looking chat rail and platform activity.
- Stream stats component used as the visual baseline for the Watch dashboard.
- Top navigation into Market, Content, Leaderboard, and Watch.
- Twitch stream popout support on pages that need a persistent video surface.

### Watch Dashboard

The Watch page is the live operations dashboard for monitoring a stream,
community chat, news, and prediction-market context at the same time.

Current development/test sources:

- Stream video: Banks' previous Twitch VOD from the home page.
- Twitch chat: `xqc`
- Kick chat: `deenthegreat`
- X/social feed: configured handles and archives through the app's X routes

Production creator use:

- Banks can be monitored through Twitch, X posts, and X broadcast chat when a
  broadcast URL is available.
- Ansem can be monitored through Kick, Twitch if enabled, and X posts/broadcasts
  when configured.
- The page is not hard-coded to the test creators; the sources are isolated in
  the Watch source configuration and collector environment variables.

Watch dashboard features:

- Three-column resizable layout with left context panel, center stream panel, and
  right aggregated chat panel.
- Collapsible left panel, chat panel, and stream stats panel.
- Smooth drag resizing for side panels.
- Fullscreen stream mode with a movable chat overlay.
- Chat overlay can be disabled and restored while the stream is fullscreen.
- Twitch embed in the center stream panel.
- Aggregated live chat from Twitch, Kick, and X in the right panel.
- Platform filter buttons to toggle which chat sources are visible.
- Chat search across users and message text.
- Chat messages populate from the bottom and move upward like a live stream chat.
- Scrollable chat feed that pauses auto-follow behavior while hovered.
- Top chatters view with message counts.
- First-time chatter highlighting.
- Ticker/cashtag detection in chat messages.
- Inline market cards for tickers with symbol, name, price, daily move, and a
  mini sparkline.
- Persistent server-side chat storage when Redis is configured, so chat history
  and top chatter data survive refreshes and stream transitions.
- Stream stats under the video: total viewers, active chatters, messages per
  minute, and per-platform viewer share.
- Stats toggle for Ansem, Banks, or Both. In the test setup, Ansem maps to the
  Kick source and Banks maps to the Twitch source.
- Bullish/bearish chat sentiment panel.
- Top live chat-word cards above the sentiment bar.
- Sentiment percentage bar styled to match the app's compact stats aesthetic.
- News/Polymarket toggle in the left panel.
- Live news cards for popular crypto and finance social/news accounts.
- Live Polymarket cards with close date, question, Yes/No odds, and an animated
  probability bar.

### OBS Overlays

Market Bubble includes OBS-ready browser-source pages for stream scenes. They
reuse the same Watch dashboard chat, news, and Polymarket sources, but render as
transparent overlay surfaces without the site navigation or Twitch popout.

Use these URLs as OBS browser sources:

```text
https://marketbubble.vercel.app/obs/chat?source=both
https://marketbubble.vercel.app/obs/news?limit=8
https://marketbubble.vercel.app/obs/polymarket?limit=6
```

Local development URLs:

```text
http://localhost:3000/obs/chat?source=both
http://localhost:3000/obs/news?limit=8
http://localhost:3000/obs/polymarket?limit=6
```

Overlay options:

- `source=ansem`, `source=banks`, or `source=both` switches the creator source
  set. `source=watch-test` uses the current public test Twitch/Kick chat setup.
- `platforms=twitch,kick,x` filters the chat overlay by platform. Use any
  comma-separated subset, for example `platforms=twitch,kick`.
- `limit=12` changes the number of chat messages, news cards, or market cards.
- `mock=1` enables mock chat data for quick scene layout testing.
- `framed=0` removes the glass panel frame from news and Polymarket overlays.

Recommended OBS setup:

- Add each overlay as a Browser Source.
- Enable transparent background.
- Use `1920x1080` for full-scene overlays, or a smaller custom width for side
  rails.
- Crop and scale the source in OBS rather than editing the app dimensions for
  every scene.

### Market

The Market page is the broader intelligence surface.

- Bottom ticker for BTC, ETH, SOL, HYPE, SPY, QQQ, TSLA, NVDA, AAPL, META, and
  GOLD.
- Global markets panel with indices, crypto, commodities, prices, 24h changes,
  and compact trend charts.
- Clickable assets that open detail modals with charts, descriptions, prices,
  news, and context.
- Market Narrative Monitor with TradingView stock and crypto heatmaps.
- News feed with bullish/bearish labels and publisher imagery.
- Smart Money Tracker for public trader and market activity.
- Polymarket market discovery by live volume and current odds.

### Content

The Content page collects Market Bubble media and social output.

- Latest public Market Bubble posts.
- Clip cards with thumbnails and metadata.
- Popup video player for clips and recent stream videos.
- Recent stream list for creator content.
- Scrollable clip rail with hidden scrollbar to preserve the app style.

The content archive can be refreshed without using the paid X API. The repository
includes a GitHub Actions workflow that uses `gallery-dl` to collect public X
metadata and media where available.

### Leaderboard

The Leaderboard page presents MarketBubble's Top 10 of CT.

- Creator/profile cards.
- Public profile metadata.
- Bullish, bearish, or neutral stance summaries based on recent public posts
  when AI keys are configured.
- Local keyword fallback when AI enrichment is not configured.

## Live Chat And Community Data

The chat system is built around a normalized community event shape shared by
Twitch, Kick, and X.

Supported sources:

- Twitch IRC/browser websocket fallback for immediate anonymous chat display.
- Twitch Helix API for official channel metadata, stream status, viewer counts,
  and recent videos when credentials are configured.
- Optional Twitch collector for server-side ingestion.
- Kick Developer API for official channel metadata and livestream status.
- Kick webhook ingestion for official `chat.message.sent` events.
- Kick websocket fallback for current public test channels.
- X public feed/archive normalization.
- Optional X broadcast collector for livestream chat when exact broadcast URLs
  are available.

Server routes:

```text
GET  /api/community-top-chat
POST /api/community-top-chat
GET  /api/community-live-events
POST /api/community-live-events
POST /api/kick-events
GET  /api/x-live-chat
```

Chat events are deduped by provider message id before counts are incremented.
That prevents multiple open clients from multiplying the same message.

When Redis is configured, chat state is shared between visitors and remains
persistent across refreshes. Without Redis, the app still works locally with a
filesystem-backed development store and browser-side live sockets.

## News And Social Feed

The Watch dashboard left panel includes a News tab built for fast scanning while
watching a stream.

- Pulls from configured crypto/finance accounts and public feeds.
- Uses real publisher/account avatars where available.
- Cards are compact and styled to match the dark Watch dashboard.
- Polls live while the tab is open.
- Removes noisy source labels from the card body so the title and source identity
  are easy to scan.

The app avoids requiring a paid X API key for the basic archive/feed flows.
Authenticated cookies or API access can be added later if deeper X coverage is
needed.

## Polymarket

The Watch dashboard Polymarket tab uses Polymarket's public Gamma API.

- Fetches active, open markets.
- Filters for crypto, AI, tech, and finance relevance.
- Chooses the most-contested market inside grouped events, so the UI does not
  show stale 0/100 contracts when a better live strike exists.
- Sorts live/contested markets first, then binary Yes/No markets, then volume.
- Refreshes every 25 seconds while the tab is open.
- Cards show close date, market question, Yes odds, No odds, and a compact
  percentage bar.

## Market And Ticker Intelligence

The app enriches live conversation with market data where possible.

- Cashtags in chat are detected and highlighted.
- Ticker messages can render inline asset cards with symbol, name, price, daily
  move, and sparkline.
- Market pages use public market/news sources and optional Massive.com
  enrichment.
- Market data is informational and should not be treated as trading advice.

## Data Sources

The app uses public/free sources by default and keeps paid keys optional.

- Yahoo Finance RSS and chart endpoints.
- CoinGecko, Binance, CoinPaprika, and Alternative.me.
- Polymarket Gamma API.
- Public Hyperliquid/HyperStats-style trader data where available.
- SEC EDGAR 13F filings.
- TradingView embeddable heatmaps.
- Twitch Helix API when Twitch credentials are configured.
- Twitch IRC/browser websocket fallback.
- Kick Developer API and Kick webhooks when credentials are configured.
- Kick browser websocket fallback for current public chat display.
- X public scraping/archive flows through `gallery-dl`.
- Massive.com, optionally, for market/news/fundamental enrichment.
- OpenRouter, optionally, for AI summaries and stance analysis.
- Upstash Redis, optionally, for shared server-side chat storage.

## Environment Variables

Create `.env.local` for local development. Do not commit it.

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional market/news enrichment
MASSIVE_API_KEY=your_massive_key_here

# Optional AI summaries
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=x-ai/grok-4.3

# Optional official Twitch live data
TWITCH_CLIENT_ID=your_twitch_app_client_id
TWITCH_CLIENT_SECRET=your_twitch_app_client_secret
TWITCH_APP_ACCESS_TOKEN=optional_static_twitch_app_access_token
TWITCH_BOT_ID=your_twitch_bot_user_id
TWITCH_OWNER_ID=your_twitch_owner_user_id
TWITCH_BROADCASTER_IDS=optional_comma_separated_broadcaster_ids

# Optional official Kick live data
KICK_CLIENT_ID=your_kick_app_client_id
KICK_CLIENT_SECRET=your_kick_app_client_secret
KICK_APP_ACCESS_TOKEN=optional_static_kick_app_access_token
KICK_CHANNEL_SLUGS=optional_comma_separated_kick_slugs

# Collector ingest
STREAM_EVENT_INGEST_SECRET=shared_random_collector_secret
MARKETBUBBLE_INGEST_URL=https://marketbubble.vercel.app/api/community-live-events

# X broadcast collector
X_BROADCAST_URLS=Banks=https://x.com/i/broadcasts/...,Ansem=https://x.com/i/broadcasts/...
X_BROADCAST_HANDLES=Banks,Ansem,MarketBubble
X_BROADCAST_DISCOVERY_SITE_URL=https://marketbubble.vercel.app
X_BROADCAST_HANDLE_POLL_MS=60000

# Browser fallback control
NEXT_PUBLIC_DISABLE_LEGACY_CHAT_SOCKETS=false

# Optional shared chat storage
KV_REST_API_URL=your_vercel_upstash_rest_url
KV_REST_API_TOKEN=your_vercel_upstash_rest_token
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

In production, set secrets in Vercel project environment variables. Do not put
real keys in source control.

The site still runs without Twitch/Kick/X credentials. In that mode, the live UI
uses public/browser fallbacks and configured test streams. Once official Twitch,
Kick, Redis, and collector credentials are configured, server-ingested live events
become the preferred path.

## Collectors

### Kick Webhook Setup

`/api/kick-events` is the Kick Developer webhook URL. It verifies Kick event
signatures and stores `chat.message.sent` events for the live chat and top
chatter UI.

After the Kick app webhook URL is configured in the Kick developer dashboard, run
the subscription helper:

```bash
KICK_CHANNEL_SLUGS=ansem,solomission npm run kick:subscribe-chat
```

The helper checks existing subscriptions before creating new ones, so it is safe
to rerun after deploys or env changes.

### Twitch Collector

The optional Twitch collector lives in:

```text
collectors/twitchio-chat-collector
```

Twitch collector ingestion requires bot and broadcaster OAuth. For channels you
do not control, the browser socket fallback keeps the public live chat experience
working without credentials.

### X Broadcast Collector

The optional X broadcast collector lives in:

```text
collectors/x-broadcast-chat-collector
```

Run it with:

```bash
npm run x:collect-broadcasts
```

Use `X_BROADCAST_URLS` for dependable monitoring of active X broadcast chats.
`X_BROADCAST_HANDLES` can poll public handle feeds for broadcast links, but X
does not expose livestream chat by username alone.

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
npm run env:check-live
npm run kick:subscribe-chat
npm run x:collect-broadcasts
```

## Deployment

The app is deployed on Vercel.

```bash
vercel --prod
```

Recommended production environment:

- `NEXT_PUBLIC_SITE_URL`
- Twitch credentials if official Twitch status, viewer counts, and recent videos
  are desired.
- Kick credentials if official Kick status, webhooks, and viewer counts are
  desired.
- `STREAM_EVENT_INGEST_SECRET` for authenticated collector ingest.
- `MARKETBUBBLE_INGEST_URL` for collectors.
- `X_BROADCAST_URLS` for X livestream chat collection.
- Redis variables for shared persistent chat storage.
- Optional Massive and OpenRouter keys for richer market/AI features.

## Security

- `.env*`, `.vercel`, `.next`, `node_modules`, build output, runtime data, and
  logs are ignored.
- API keys, cookies, OAuth tokens, and browser session exports must stay in local
  or hosting-provider environment variables.
- Public API routes sanitize handles, channel names, asset ids, links, and media
  URLs before calling upstream providers.
- The repository should contain placeholders only, never real API keys.
- Runtime chat data belongs in Redis or local ignored `.data/`, not in Git.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- CSS Modules and global CSS
- Vercel Functions
- Upstash Redis through Vercel env vars
- `react-icons`
- `fast-xml-parser`
- `ws`

## License

MIT. See `LICENSE`.
