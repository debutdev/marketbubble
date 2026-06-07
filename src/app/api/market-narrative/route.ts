import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type NarrativeKey = "ai" | "stablecoins" | "liquidity" | "crypto" | "rates" | "elections";

type NewsItem = {
  impact: number;
  imageUrl: string;
  narrativeKeys: NarrativeKey[];
  publishedAt: string | null;
  source: string;
  sourceLogoUrl: string;
  tone: "bullish" | "bearish";
  title: string;
  url: string;
};

type HeatmapTile = {
  changePercent: number;
  label: string;
  source: string;
  type: "stock" | "crypto";
};

type ParsedRssItem = {
  description?: string | { cdata?: string; "#text"?: string };
  enclosure?: {
    "@_url"?: string;
  };
  guid?: string | { "#text"?: string };
  link?: string;
  "media:content"?:
    | {
        "@_url"?: string;
      }
    | Array<{
        "@_url"?: string;
      }>;
  "media:thumbnail"?:
    | {
        "@_url"?: string;
      }
    | Array<{
        "@_url"?: string;
      }>;
  pubDate?: string;
  title?: string;
};

type ParsedRss = {
  rss?: {
    channel?: {
      item?: ParsedRssItem | ParsedRssItem[];
      title?: string;
    };
  };
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        chartPreviousClose?: number;
        currency?: string;
        previousClose?: number;
        regularMarketPrice?: number;
      };
    }>;
  };
};

type CoinGeckoMarketsResponse = Array<{
  current_price?: number;
  id?: string;
  price_change_percentage_24h?: number;
}>;

type GammaMarket = {
  active?: boolean;
  closed?: boolean;
  question?: string;
  volume24hr?: number | string;
  volumeNum?: number | string;
};

type GammaEvent = {
  id: string;
  markets?: GammaMarket[];
  slug: string;
  title: string;
  volume24hr?: number | string;
  volume?: number | string;
};

const parser = new XMLParser({
  cdataPropName: "cdata",
  ignoreAttributes: false,
});

const stockHeatmapAssets = [
  { label: "AAPL", yahooSymbol: "AAPL" },
  { label: "MSFT", yahooSymbol: "MSFT" },
  { label: "NVDA", yahooSymbol: "NVDA" },
  { label: "GOOGL", yahooSymbol: "GOOGL" },
  { label: "AMZN", yahooSymbol: "AMZN" },
  { label: "META", yahooSymbol: "META" },
  { label: "TSLA", yahooSymbol: "TSLA" },
  { label: "BRK.A", yahooSymbol: "BRK-A" },
  { label: "JPM", yahooSymbol: "JPM" },
  { label: "V", yahooSymbol: "V" },
  { label: "MA", yahooSymbol: "MA" },
  { label: "LLY", yahooSymbol: "LLY" },
];

const cryptoHeatmapAssets = [
  { id: "bitcoin", label: "BTC" },
  { id: "ethereum", label: "ETH" },
  { id: "solana", label: "SOL" },
  { id: "binancecoin", label: "BNB" },
  { id: "ripple", label: "XRP" },
  { id: "hyperliquid", label: "HYPE" },
];

const narrativeConfig: Array<{
  key: NarrativeKey;
  label: string;
  patterns: RegExp[];
}> = [
  {
    key: "ai",
    label: "AI Infrastructure",
    patterns: [/\bai\b/i, /artificial intelligence/i, /nvidia|nvda/i, /chips?|semiconductor/i, /data centers?/i],
  },
  {
    key: "stablecoins",
    label: "Stablecoins",
    patterns: [/stablecoin/i, /\busdc\b/i, /\busdt\b/i, /tether/i, /circle/i],
  },
  {
    key: "liquidity",
    label: "Treasury Liquidity",
    patterns: [/treasury/i, /liquidity/i, /dollar/i, /yield/i, /bonds?/i],
  },
  {
    key: "crypto",
    label: "Crypto Beta",
    patterns: [/bitcoin|btc/i, /ethereum|eth/i, /solana|sol\b/i, /crypto/i, /coinbase|binance/i],
  },
  {
    key: "rates",
    label: "Rate Path",
    patterns: [/fed|fomc/i, /rates?|rate cuts?/i, /inflation|cpi/i, /jobs report/i],
  },
  {
    key: "elections",
    label: "Election Markets",
    patterns: [/election/i, /trump|biden|president/i, /polls?/i, /campaign/i],
  },
];

const newsFeeds = [
  {
    domain: "finance.yahoo.com",
    source: "Yahoo Finance",
    url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,MSFT,NVDA,GOOGL,AMZN,META,TSLA,BTC-USD,ETH-USD&region=US&lang=en-US",
  },
  { domain: "coindesk.com", source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { domain: "marketwatch.com", source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
];

const marketNarrativeCacheHeaders = {
  "Cache-Control": "public, max-age=90, s-maxage=180, stale-while-revalidate=900",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumber(value: number | string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function getText(description: ParsedRssItem["description"]) {
  if (typeof description === "string") {
    return description;
  }

  return description?.cdata ?? description?.["#text"] ?? "";
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function getFirstMediaUrl(
  media:
    | {
        "@_url"?: string;
      }
    | Array<{
        "@_url"?: string;
      }>
    | undefined,
) {
  if (Array.isArray(media)) {
    return media.find((item) => item["@_url"])?.["@_url"] ?? "";
  }

  return media?.["@_url"] ?? "";
}

function getDescriptionImage(descriptionHtml: string) {
  return descriptionHtml.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? "";
}

function safeExternalUrl(value: string, fallback = "") {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function getSourceLogoUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function getNewsTone(text: string): NewsItem["tone"] {
  const bullishMatches = text.match(
    /\b(rally|surge|jumps?|gains?|beats?|record high|breakout|upgrade|bullish|inflows?|approval|accelerates|strong|tops?|raises?|buyback|profit|growth|pops?)\b/gi,
  );
  const bearishMatches = text.match(
    /\b(falls?|drops?|plunges?|misses?|cuts?|selloff|bearish|lawsuit|probe|warning|weak|slump|loss|recession|inflation|deficit|risk|fear|bloodbath|hikes?)\b/gi,
  );
  const bullishScore = bullishMatches?.length ?? 0;
  const bearishScore = bearishMatches?.length ?? 0;

  return bearishScore > bullishScore ? "bearish" : "bullish";
}

function getNarrativeKeys(text: string) {
  return narrativeConfig
    .filter((narrative) => narrative.patterns.some((pattern) => pattern.test(text)))
    .map((narrative) => narrative.key);
}

function getChangePercent(price: number, previousClose: number) {
  if (!previousClose) {
    return 0;
  }

  return ((price - previousClose) / previousClose) * 100;
}

function getImpact(title: string, keys: NarrativeKey[], publishedAt: string | null) {
  const ageHours = publishedAt ? Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 3_600_000) : 12;
  const recencyScore = Math.max(0, 2.4 - ageHours / 6);
  const keywordScore = keys.length * 1.05;
  const urgencyScore = /\b(surge|record|high|low|plunge|rally|cuts?|inflation|earnings|approval|etf)\b/i.test(title)
    ? 1.2
    : 0.4;

  return Math.min(9.9, Number((4.4 + recencyScore + keywordScore + urgencyScore).toFixed(1)));
}

async function fetchRssFeed(feed: (typeof newsFeeds)[number]) {
  const response = await fetch(feed.url, {
    cache: "no-store",
    headers: {
      Accept: "application/rss+xml,text/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "MarketBubble/1.0",
    },
  });

  if (!response.ok) {
    return [];
  }

  const parsed = parser.parse(await response.text()) as ParsedRss;
  const rawItems = parsed.rss?.channel?.item
    ? Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item]
    : [];

  return rawItems
    .map<NewsItem | null>((item) => {
      const title = stripHtml(item.title ?? "");
      const descriptionHtml = getText(item.description);
      const description = stripHtml(descriptionHtml);
      const text = `${title} ${description}`;
      const narrativeKeys = getNarrativeKeys(text);

      if (!title || !narrativeKeys.length) {
        return null;
      }

      const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : null;

      return {
        impact: getImpact(title, narrativeKeys, publishedAt),
        imageUrl:
          safeExternalUrl(
            getFirstMediaUrl(item["media:thumbnail"]) ||
              getFirstMediaUrl(item["media:content"]) ||
              item.enclosure?.["@_url"] ||
              getDescriptionImage(descriptionHtml),
            getSourceLogoUrl(feed.domain),
          ),
        narrativeKeys,
        publishedAt,
        source: feed.source,
        sourceLogoUrl: getSourceLogoUrl(feed.domain),
        tone: getNewsTone(title),
        title,
        url: safeExternalUrl(item.link ?? ""),
      };
    })
    .filter((item) => item !== null);
}

async function fetchYahooTile(asset: (typeof stockHeatmapAssets)[number]): Promise<HeatmapTile | null> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.yahooSymbol)}?range=1d&interval=1m`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "MarketBubble/1.0",
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as YahooChartResponse;
  const meta = payload.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;

  if (!isFiniteNumber(price) || !isFiniteNumber(previousClose)) {
    return null;
  }

  return {
    changePercent: getChangePercent(price, previousClose),
    label: asset.label,
    source: "Yahoo Finance",
    type: "stock",
  };
}

async function fetchCryptoTiles(): Promise<HeatmapTile[]> {
  const ids = cryptoHeatmapAssets.map((asset) => asset.id).join(",");
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "MarketBubble/1.0",
      },
    },
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as CoinGeckoMarketsResponse;
  const quotes = new Map(payload.map((quote) => [quote.id, quote]));

  return cryptoHeatmapAssets
    .map<HeatmapTile | null>((asset) => {
      const quote = quotes.get(asset.id);

      if (!isFiniteNumber(quote?.price_change_percentage_24h)) {
        return null;
      }

      return {
        changePercent: quote.price_change_percentage_24h,
        label: asset.label,
        source: "CoinGecko",
        type: "crypto",
      };
    })
    .filter((tile) => tile !== null);
}

function chooseMarket(event: GammaEvent) {
  return (
    event.markets?.find((market) => market.active && !market.closed) ??
    event.markets?.[0]
  );
}

async function fetchPolymarketData() {
  const response = await fetch(
    "https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume_24hr&ascending=false&limit=100",
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "MarketBubble/1.0",
      },
    },
  );

  if (!response.ok) {
    return { volumeByNarrative: new Map<NarrativeKey, number>() };
  }

  const events = (await response.json()) as GammaEvent[];
  const volumeByNarrative = new Map<NarrativeKey, number>();

  events.forEach((event) => {
    const market = chooseMarket(event);
    const title = market?.question ?? event.title;
    const keys = getNarrativeKeys(title);
    const volume24h = toNumber(market?.volume24hr) || toNumber(event.volume24hr);

    keys.forEach((key) => {
      volumeByNarrative.set(key, (volumeByNarrative.get(key) ?? 0) + volume24h);
    });
  });

  return { volumeByNarrative };
}

function buildNarratives(news: NewsItem[], volumeByNarrative: Map<NarrativeKey, number>) {
  const now = Date.now();

  return narrativeConfig
    .map((config) => {
      const items = news.filter((item) => item.narrativeKeys.includes(config.key));
      const recentMentions = items.filter((item) => {
        if (!item.publishedAt) {
          return false;
        }

        return now - new Date(item.publishedAt).getTime() <= 6 * 3_600_000;
      }).length;
      const previousMentions = items.filter((item) => {
        if (!item.publishedAt) {
          return false;
        }

        const age = now - new Date(item.publishedAt).getTime();
        return age > 6 * 3_600_000 && age <= 24 * 3_600_000;
      }).length;
      const mentionVelocity = previousMentions
        ? ((recentMentions - previousMentions) / previousMentions) * 100
        : recentMentions * 32;
      const averageImpact = items.length
        ? items.reduce((sum, item) => sum + item.impact, 0) / items.length
        : 4.8;
      const sentiment = Math.max(
        1,
        Math.min(99, Math.round(averageImpact * 9.2 + Math.max(-18, Math.min(18, mentionVelocity / 4)))),
      );
      const capitalInflow = volumeByNarrative.get(config.key) ?? 0;
      const trend = Array.from({ length: 18 }, (_, index) => {
        const recencyWeight = items.filter((item) => {
          if (!item.publishedAt) {
            return false;
          }

          const ageHours = (now - new Date(item.publishedAt).getTime()) / 3_600_000;
          return ageHours <= 24 - index;
        }).length;

        return recencyWeight + index * 0.18 + sentiment / 40;
      });

      return {
        capitalInflow,
        label: config.label,
        mentionVelocity: Number(mentionVelocity.toFixed(0)),
        sentiment,
        trend,
      };
    })
    .sort((a, b) => b.sentiment + b.capitalInflow / 100_000 - (a.sentiment + a.capitalInflow / 100_000))
    .slice(0, 5);
}

export async function GET() {
  try {
    const [newsResults, stockResults, cryptoTiles, polymarket] = await Promise.all([
      Promise.allSettled(newsFeeds.map(fetchRssFeed)),
      Promise.allSettled(stockHeatmapAssets.map(fetchYahooTile)),
      fetchCryptoTiles(),
      fetchPolymarketData(),
    ]);
    const news = newsResults
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .sort((a, b) => {
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        return b.impact - a.impact || bTime - aTime;
      })
      .slice(0, 8);
    const stockTiles = stockResults
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter((tile) => tile !== null);
    const heatmap = [...stockTiles, ...cryptoTiles].slice(0, 24);

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      heatmap,
      narratives: buildNarratives(news, polymarket.volumeByNarrative),
      news,
      sources: ["Yahoo Finance", "CoinGecko", "Polymarket Gamma", ...newsFeeds.map((feed) => feed.source)],
    }, { headers: marketNarrativeCacheHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load market narrative data.",
        heatmap: [],
        narratives: [],
        news: [],
      },
      { headers: marketNarrativeCacheHeaders, status: 500 },
    );
  }
}
