# Market Bubble

Market Bubble is a public market dashboard built for the MarketBubble vibecoding challenge.

It combines a live stream-first homepage with a market intelligence page for crypto, equities, macro assets, news, Polymarket activity, and smart-money signals. The challenge post is here: https://x.com/MarketBubble/status/2062574325970973093

## Challenge Note

Some stream/chat presentation data is currently mocked because the referenced creators are not streaming right now. The live market, news, Polymarket, SEC, HyperStats, and quote data paths work; the mock stream data is included so reviewers can see what the experience looks like during an active stream.

## Features

- Market page with a bottom ticker for popular crypto, stocks, and commodities.
- Global Markets panel with clickable asset details, charts, descriptions, and recent news.
- Market Narrative Monitor with TradingView stock/crypto heatmaps and live news tone labels.
- Smart Money Tracker with Hyperliquid traders, SEC 13F portfolio snapshots, and Polymarket markets by volume.
- Twitch stream popout that appears on secondary pages and can be moved, minimized, or closed.
- Responsive Next.js App Router implementation with TypeScript and Tailwind CSS.

## Data Sources

The app uses free or public data sources where possible:

- Yahoo Finance RSS and chart endpoints
- CoinGecko, Binance, CoinPaprika, and Alternative.me
- Polymarket Gamma API
- HyperStats public trader data
- SEC EDGAR 13F filings
- TradingView embeddable heatmaps
- Massive.com, optionally, for CUSIP-to-ticker enrichment

This project is for informational and challenge/demo purposes only. It is not financial advice.

## Local Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

## Environment Variables

Create `.env.local` for local secrets. Do not commit it.

```bash
MASSIVE_API_KEY=your_massive_key_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`MASSIVE_API_KEY` is optional. Without it, the app falls back to built-in ticker aliases for portfolio holdings where possible.

For Vercel, set these values in the project environment settings instead of committing them to Git.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Security Notes

- `.env*`, `.vercel`, `.next`, and `node_modules` are ignored.
- API keys must stay in local or hosting-provider environment variables.
- Public API routes proxy only fixed upstream data providers and sanitize user-controlled handles, channel names, links, and media URLs.

## License

MIT. See `LICENSE`.
