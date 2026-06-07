import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type MarketTickerAsset = {
  changePercent: number;
  currency: string | null;
  name: string;
  price: number;
  source: string;
  symbol: string;
  trend?: number[];
  type: "crypto" | "equity" | "commodity" | "index";
};

type CryptoAssetConfig = {
  id: string;
  name: string;
  symbol: string;
};

type YahooAssetConfig = {
  name: string;
  symbol: string;
  type: MarketTickerAsset["type"];
  yahooSymbol: string;
};

type CoinGeckoMarketsResponse = Array<{
  current_price?: number;
  id?: string;
  price_change_percentage_24h?: number;
  sparkline_in_7d?: {
    price?: number[];
  };
}>;

type YahooChartResponse = {
  chart?: {
    error?: {
      description?: string;
    } | null;
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
    }>;
  };
};

type BinanceTickerResponse = Array<{
  lastPrice?: string;
  priceChangePercent?: string;
  symbol?: string;
}>;

type BinanceKlineResponse = Array<Array<number | string>>;

type CoinPaprikaTickerResponse = {
  quotes?: {
    USD?: {
      percent_change_24h?: number;
      price?: number;
    };
  };
};

const cryptoAssets: CryptoAssetConfig[] = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "solana", name: "Solana", symbol: "SOL" },
  { id: "hyperliquid", name: "Hyperliquid", symbol: "HYPE" },
];

const yahooAssets: YahooAssetConfig[] = [
  { name: "SPDR S&P 500 ETF", symbol: "SPY", type: "equity", yahooSymbol: "SPY" },
  { name: "Invesco QQQ ETF", symbol: "QQQ", type: "equity", yahooSymbol: "QQQ" },
  { name: "Tesla", symbol: "TSLA", type: "equity", yahooSymbol: "TSLA" },
  { name: "Nvidia", symbol: "NVDA", type: "equity", yahooSymbol: "NVDA" },
  { name: "Apple", symbol: "AAPL", type: "equity", yahooSymbol: "AAPL" },
  { name: "Meta", symbol: "META", type: "equity", yahooSymbol: "META" },
  { name: "Gold Futures", symbol: "GOLD", type: "commodity", yahooSymbol: "GC=F" },
];

const stockIndexAssets: YahooAssetConfig[] = [
  { name: "S&P 500", symbol: "S&P 500", type: "index", yahooSymbol: "^GSPC" },
  { name: "Nasdaq", symbol: "Nasdaq", type: "index", yahooSymbol: "^IXIC" },
  { name: "Dow Jones", symbol: "Dow Jones", type: "index", yahooSymbol: "^DJI" },
  { name: "Russell 2000", symbol: "Russell 2000", type: "index", yahooSymbol: "^RUT" },
];

const commodityAssets: YahooAssetConfig[] = [
  { name: "Gold", symbol: "Gold", type: "commodity", yahooSymbol: "GC=F" },
  { name: "Silver", symbol: "Silver", type: "commodity", yahooSymbol: "SI=F" },
  { name: "Oil", symbol: "Oil", type: "commodity", yahooSymbol: "CL=F" },
];

const marketTickerCacheHeaders = {
  "Cache-Control": "public, max-age=45, s-maxage=60, stale-while-revalidate=300",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getLastFiniteValue(values: Array<number | null> | undefined) {
  if (!values) {
    return null;
  }

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];

    if (isFiniteNumber(value)) {
      return value;
    }
  }

  return null;
}

function getChangePercent(price: number, previousClose: number) {
  if (!previousClose) {
    return 0;
  }

  return ((price - previousClose) / previousClose) * 100;
}

function sampleTrend(values: number[], maxPoints = 18) {
  const finiteValues = values.filter(isFiniteNumber);

  if (finiteValues.length <= maxPoints) {
    return finiteValues;
  }

  const step = (finiteValues.length - 1) / (maxPoints - 1);

  return Array.from({ length: maxPoints }, (_, index) => finiteValues[Math.round(index * step)]);
}

async function fetchCryptoAssets() {
  const ids = cryptoAssets.map((asset) => asset.id).join(",");
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h&sparkline=true`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "MarketBubble/1.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Unable to load crypto prices.");
  }

  const payload = (await response.json()) as CoinGeckoMarketsResponse;
  const quotes = new Map(payload.map((quote) => [quote.id, quote]));

  return cryptoAssets
    .map<MarketTickerAsset | null>((asset) => {
      const quote = quotes.get(asset.id);

      if (!isFiniteNumber(quote?.current_price)) {
        return null;
      }

      return {
        changePercent: isFiniteNumber(quote.price_change_percentage_24h)
          ? quote.price_change_percentage_24h
          : 0,
        currency: "USD",
        name: asset.name,
        price: quote.current_price,
        source: "CoinGecko",
        symbol: asset.symbol,
        trend: sampleTrend(quote.sparkline_in_7d?.price ?? []),
        type: "crypto",
      };
    })
    .filter((asset) => asset !== null);
}

async function fetchBinanceTrend(symbol: string) {
  const response = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`,
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

  const payload = (await response.json()) as BinanceKlineResponse;

  return sampleTrend(
    payload
      .map((kline) => Number(kline[4]))
      .filter(isFiniteNumber),
  );
}

async function fetchFallbackCryptoAssets() {
  const [binanceResponse, hypeResponse] = await Promise.allSettled([
    fetch(
      "https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D",
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "MarketBubble/1.0",
        },
      },
    ),
    fetch("https://api.coinpaprika.com/v1/tickers/hype-hyperliquid", {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "MarketBubble/1.0",
      },
    }),
  ]);
  const binanceAssets: MarketTickerAsset[] = [];

  if (binanceResponse.status === "fulfilled" && binanceResponse.value.ok) {
    const payload = (await binanceResponse.value.json()) as BinanceTickerResponse;
    const config = new Map([
      ["BTCUSDT", { name: "Bitcoin", symbol: "BTC" }],
      ["ETHUSDT", { name: "Ethereum", symbol: "ETH" }],
      ["SOLUSDT", { name: "Solana", symbol: "SOL" }],
    ]);
    const trends = await Promise.allSettled(payload.map((quote) => fetchBinanceTrend(quote.symbol ?? "")));

    payload.forEach((quote, index) => {
      const asset = quote.symbol ? config.get(quote.symbol) : null;
      const price = Number(quote.lastPrice);
      const changePercent = Number(quote.priceChangePercent);

      if (!asset || !isFiniteNumber(price) || !isFiniteNumber(changePercent)) {
        return;
      }

      binanceAssets.push({
        changePercent,
        currency: "USD",
        name: asset.name,
        price,
        source: "Binance",
        symbol: asset.symbol,
        trend: trends[index]?.status === "fulfilled" ? trends[index].value : [],
        type: "crypto",
      });
    });
  }

  if (hypeResponse.status === "fulfilled" && hypeResponse.value.ok) {
    const payload = (await hypeResponse.value.json()) as CoinPaprikaTickerResponse;
    const price = payload.quotes?.USD?.price;
    const changePercent = payload.quotes?.USD?.percent_change_24h;

    if (isFiniteNumber(price) && isFiniteNumber(changePercent)) {
      binanceAssets.push({
        changePercent,
        currency: "USD",
        name: "Hyperliquid",
        price,
        source: "CoinPaprika",
        symbol: "HYPE",
        trend: [],
        type: "crypto",
      });
    }
  }

  const order = new Map(cryptoAssets.map((asset, index) => [asset.symbol, index]));

  return binanceAssets.sort((a, b) => (order.get(a.symbol) ?? 99) - (order.get(b.symbol) ?? 99));
}

async function fetchYahooAsset(asset: YahooAssetConfig) {
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
  const result = payload.chart?.result?.[0];
  const price =
    result?.meta && isFiniteNumber(result.meta.regularMarketPrice)
      ? result.meta.regularMarketPrice
      : getLastFiniteValue(result?.indicators?.quote?.[0]?.close);
  const previousClose = result?.meta?.chartPreviousClose ?? result?.meta?.previousClose;
  const closes = result?.indicators?.quote?.[0]?.close?.filter(isFiniteNumber) ?? [];

  if (!isFiniteNumber(price) || !isFiniteNumber(previousClose)) {
    return null;
  }

  return {
    changePercent: getChangePercent(price, previousClose),
    currency: asset.symbol === "DXY" ? null : result?.meta?.currency ?? "USD",
    name: asset.name,
    price,
    source: "Yahoo Finance",
    symbol: asset.symbol,
    trend: sampleTrend(closes),
    type: asset.type,
  } satisfies MarketTickerAsset;
}

export async function GET() {
  try {
    const [cryptoResults, yahooResults, indexResults, commodityResults] = await Promise.allSettled([
      fetchCryptoAssets(),
      Promise.all(yahooAssets.map(fetchYahooAsset)),
      Promise.all(stockIndexAssets.map(fetchYahooAsset)),
      Promise.all(commodityAssets.map(fetchYahooAsset)),
    ]);
    const cryptoTicker =
      cryptoResults.status === "fulfilled" && cryptoResults.value.length
        ? cryptoResults.value
        : await fetchFallbackCryptoAssets();
    const yahooTicker =
      yahooResults.status === "fulfilled"
        ? yahooResults.value.filter((asset) => asset !== null)
        : [];
    const stockIndices =
      indexResults.status === "fulfilled"
        ? indexResults.value.filter((asset) => asset !== null)
        : [];
    const commodities =
      commodityResults.status === "fulfilled"
        ? commodityResults.value.filter((asset) => asset !== null)
        : [];
    const assets = [...cryptoTicker, ...yahooTicker];

    if (!assets.length) {
      return NextResponse.json(
        { assets: [], error: "Unable to load market ticker." },
        { headers: marketTickerCacheHeaders, status: 502 },
      );
    }

    return NextResponse.json({
      assets,
      fetchedAt: new Date().toISOString(),
      globalMarkets: {
        commodities,
        crypto: cryptoTicker,
        stockIndices,
      },
    }, { headers: marketTickerCacheHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        assets: [],
        error: error instanceof Error ? error.message : "Unable to load market ticker.",
      },
      { headers: marketTickerCacheHeaders, status: 500 },
    );
  }
}
