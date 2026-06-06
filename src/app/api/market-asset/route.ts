import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AssetConfig = {
  description: string;
  displayTicker: string;
  name: string;
  newsSymbol: string;
  yahooSymbol?: string;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
      meta?: {
        chartPreviousClose?: number;
        currency?: string;
        previousClose?: number;
        regularMarketPrice?: number;
      };
      timestamp?: number[];
    }>;
  };
};

type CoinGeckoMarketChart = {
  prices?: Array<[number, number]>;
};

type ParsedRssItem = {
  link?: string;
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

const parser = new XMLParser({
  ignoreAttributes: false,
});

const assetConfigs: Record<string, AssetConfig> = {
  BTC: {
    description: "Bitcoin is the largest crypto asset by market value and is commonly tracked as the benchmark for crypto risk appetite.",
    displayTicker: "BTC",
    name: "Bitcoin",
    newsSymbol: "BTC-USD",
    yahooSymbol: "BTC-USD",
  },
  ETH: {
    description: "Ethereum is a smart-contract network whose token price is widely used as a gauge for crypto application and infrastructure demand.",
    displayTicker: "ETH",
    name: "Ethereum",
    newsSymbol: "ETH-USD",
    yahooSymbol: "ETH-USD",
  },
  GOLD: {
    description: "Gold futures track the market price of gold, often used as a macro hedge against real-rate, currency, and geopolitical risk.",
    displayTicker: "GC=F",
    name: "Gold Futures",
    newsSymbol: "GC=F",
    yahooSymbol: "GC=F",
  },
  HYPE: {
    description: "Hyperliquid is the token associated with the Hyperliquid ecosystem, commonly watched by crypto traders for perp DEX activity.",
    displayTicker: "HYPE",
    name: "Hyperliquid",
    newsSymbol: "HYPE-USD",
  },
  NASDAQ: {
    description: "The Nasdaq Composite tracks thousands of Nasdaq-listed companies and is heavily influenced by large technology and growth stocks.",
    displayTicker: "IXIC",
    name: "Nasdaq Composite",
    newsSymbol: "QQQ",
    yahooSymbol: "^IXIC",
  },
  OIL: {
    description: "Crude oil futures track benchmark oil prices and are sensitive to supply, demand, inventory, OPEC, and geopolitical developments.",
    displayTicker: "CL=F",
    name: "Crude Oil Futures",
    newsSymbol: "CL=F",
    yahooSymbol: "CL=F",
  },
  "RUSSELL 2000": {
    description: "The Russell 2000 tracks U.S. small-cap stocks and is often used as a measure of domestic cyclicals and risk breadth.",
    displayTicker: "RUT",
    name: "Russell 2000",
    newsSymbol: "IWM",
    yahooSymbol: "^RUT",
  },
  "DOW JONES": {
    description: "The Dow Jones Industrial Average tracks 30 large U.S. blue-chip companies and is one of the oldest U.S. stock benchmarks.",
    displayTicker: "DJI",
    name: "Dow Jones Industrial Average",
    newsSymbol: "DIA",
    yahooSymbol: "^DJI",
  },
  SILVER: {
    description: "Silver futures track the market price of silver, a precious metal influenced by both macro hedging and industrial demand.",
    displayTicker: "SI=F",
    name: "Silver Futures",
    newsSymbol: "SI=F",
    yahooSymbol: "SI=F",
  },
  SOL: {
    description: "Solana is a high-throughput smart-contract network whose token is often watched for crypto beta and application activity.",
    displayTicker: "SOL",
    name: "Solana",
    newsSymbol: "SOL-USD",
    yahooSymbol: "SOL-USD",
  },
  "S&P 500": {
    description: "The S&P 500 is a market-cap-weighted benchmark of leading U.S. large-cap companies and a core gauge of U.S. equity performance.",
    displayTicker: "SPX",
    name: "S&P 500",
    newsSymbol: "SPY",
    yahooSymbol: "^GSPC",
  },
};

const coingeckoIds: Record<string, string> = {
  HYPE: "hyperliquid",
};

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getAssetConfig(symbol: string, name: string) {
  const symbolKey = symbol.trim().toUpperCase();
  const nameKey = name.trim().toUpperCase();

  return (
    assetConfigs[symbolKey] ??
    assetConfigs[nameKey] ??
    {
      description: `${name || symbol} is tracked in the Market Bubble global markets panel.`,
      displayTicker: symbol || name,
      name: name || symbol,
      newsSymbol: symbol || name,
      yahooSymbol: symbol,
    }
  );
}

function getChangePercent(price: number | null, previousClose: number | null) {
  if (price === null || previousClose === null || previousClose === 0) {
    return null;
  }

  return ((price - previousClose) / previousClose) * 100;
}

function normalizeYahooChart(payload: YahooChartResponse) {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const chart = timestamps
    .map((timestamp, index) => ({
      close: closes[index],
      time: new Date(timestamp * 1000).toISOString(),
    }))
    .filter((point): point is { close: number; time: string } => Number.isFinite(point.close));
  const price = toNumber(result?.meta?.regularMarketPrice) ?? chart.at(-1)?.close ?? null;
  const previousClose =
    chart.length >= 2
      ? chart[chart.length - 2].close
      : toNumber(result?.meta?.previousClose) ?? toNumber(result?.meta?.chartPreviousClose);

  return {
    changePercent: getChangePercent(price, previousClose),
    chart,
    currency: result?.meta?.currency ?? "USD",
    price,
  };
}

async function fetchYahooChart(yahooSymbol: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1mo&interval=1d`,
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

  return normalizeYahooChart((await response.json()) as YahooChartResponse);
}

async function fetchCoinGeckoChart(id: string) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=30&interval=daily`,
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

  const payload = (await response.json()) as CoinGeckoMarketChart;
  const chart = (payload.prices ?? []).map(([timestamp, close]) => ({
    close,
    time: new Date(timestamp).toISOString(),
  }));
  const price = chart.at(-1)?.close ?? null;
  const previousClose = chart.at(-2)?.close ?? null;

  return {
    changePercent: getChangePercent(price, previousClose),
    chart,
    currency: "USD",
    price,
  };
}

function stripHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeExternalUrl(value: string, fallback = "") {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

async function fetchNews(newsSymbol: string) {
  const response = await fetch(
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(newsSymbol)}&region=US&lang=en-US`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/rss+xml,text/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "MarketBubble/1.0",
      },
    },
  );

  if (!response.ok) {
    return [];
  }

  const parsed = parser.parse(await response.text()) as ParsedRss;
  const rawItems = parsed.rss?.channel?.item
    ? Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item]
    : [];

  return rawItems.slice(0, 4).map((item) => ({
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
    source: "Yahoo Finance",
    title: stripHtml(item.title ?? ""),
    url: safeExternalUrl(item.link ?? ""),
  }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "";
  const name = url.searchParams.get("name") ?? "";
  const config = getAssetConfig(symbol, name);
  const chartSource = config.yahooSymbol
    ? await fetchYahooChart(config.yahooSymbol)
    : coingeckoIds[config.displayTicker]
      ? await fetchCoinGeckoChart(coingeckoIds[config.displayTicker])
      : null;
  const news = await fetchNews(config.newsSymbol);

  return NextResponse.json({
    asset: {
      description: config.description,
      name: config.name,
      ticker: config.displayTicker,
    },
    chart: chartSource?.chart ?? [],
    changePercent: chartSource?.changePercent ?? null,
    currency: chartSource?.currency ?? "USD",
    fetchedAt: new Date().toISOString(),
    news,
    price: chartSource?.price ?? null,
    sources: ["Yahoo Finance", ...(coingeckoIds[config.displayTicker] ? ["CoinGecko"] : [])],
  });
}
