import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type HyperStatsTrader = {
  activePositions?: number;
  address?: string;
  grade?: string;
  mainToken?: string | null;
  pnl30d?: {
    amount?: string;
    percentage?: number;
  };
  rank?: number;
  totalTrades?: number;
  winRate?: number;
};

type HyperStatsResponse = {
  lastUpdated?: string;
  traders?: HyperStatsTrader[];
};

type SecFeed = {
  feed?: {
    entry?: SecEntry | SecEntry[];
  };
};

type SecEntry = {
  content?: {
    "accession-number"?: string;
    "filing-date"?: string;
  };
};

type SecIndex = {
  directory?: {
    item?: Array<{
      name?: string;
      size?: string;
    }>;
  };
};

type SecInformationTable = {
  informationTable?: {
    infoTable?: SecHolding | SecHolding[];
  };
};

type SecHolding = {
  cusip?: string;
  nameOfIssuer?: string;
  value?: number | string;
};

type MassiveTickerResponse = {
  results?: Array<{
    ticker?: string;
  }>;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketPrice?: number;
      };
    }>;
  };
};

type GammaMarket = {
  acceptingOrders?: boolean;
  active?: boolean;
  bestAsk?: number | string;
  bestBid?: number | string;
  closed?: boolean;
  oneDayPriceChange?: number | string;
  outcomePrices?: string | string[];
  outcomes?: string | string[];
  question?: string;
  volume?: number | string;
  volume24hr?: number | string;
  volumeNum?: number | string;
};

type GammaEvent = {
  active?: boolean;
  closed?: boolean;
  id: string;
  markets?: GammaMarket[];
  slug: string;
  title: string;
  volume?: number | string;
  volume24hr?: number | string;
};

const secParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  removeNSPrefix: true,
});

const portfolioManagers = [
  { cik: "0001067983", label: "Warren Buffett", manager: "Berkshire" },
  { cik: "0001649339", label: "Michael Burry", manager: "Scion" },
  { cik: "0001697748", label: "Cathie Wood", manager: "ARK Invest" },
  { cik: "0001536411", label: "Stanley Druckenmiller", manager: "Duquesne" },
];

const tickerAliases = new Map<string, string>([
  ["007903107", "AMD"],
  ["025816109", "AXP"],
  ["037833100", "AAPL"],
  ["191216100", "KO"],
  ["457669307", "INSM"],
  ["632307104", "NTRA"],
  ["67066G104", "NVDA"],
  ["69608A108", "PLTR"],
  ["717081103", "PFE"],
  ["88160R101", "TSLA"],
  ["H17182108", "CRSP"],
]);
const smartMoneyCacheHeaders = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
};

function toNumber(value: number | string | undefined | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAddress(address: string | undefined) {
  if (!address) {
    return "Unknown";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseJsonArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function getChangePercent(price: number, previousClose: number) {
  if (!previousClose) {
    return 0;
  }

  return ((price - previousClose) / previousClose) * 100;
}

function chooseMarket(event: GammaEvent) {
  const markets = event.markets ?? [];

  return (
    markets.find((market) => market.active && !market.closed && market.acceptingOrders) ??
    markets.find((market) => market.active && !market.closed) ??
    markets[0]
  );
}

function getMarketProbability(market?: GammaMarket) {
  const outcomes = parseJsonArray(market?.outcomes);
  const prices = parseJsonArray(market?.outcomePrices).map(Number);
  const yesIndex = Math.max(
    0,
    outcomes.findIndex((outcome) => outcome.toLowerCase() === "yes"),
  );
  const yesPrice = prices[yesIndex];
  const noPrice = prices.find((_, index) => index !== yesIndex);
  const finiteYesPrice = typeof yesPrice === "number" && Number.isFinite(yesPrice) ? yesPrice : null;
  const finiteNoPrice = typeof noPrice === "number" && Number.isFinite(noPrice) ? noPrice : null;

  return {
    no: finiteNoPrice === null ? null : Math.round(finiteNoPrice * 100),
    yes: finiteYesPrice === null ? null : Math.round(finiteYesPrice * 100),
  };
}

async function fetchHyperliquidTraders() {
  const response = await fetch(
    "https://v2-api.hyperstats.org/api/traders/top?limit=5&offset=0&sortBy=pnl_30d&order=desc",
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "MarketBubble/1.0",
      },
    },
  );

  if (!response.ok) {
    return { lastUpdated: null, traders: [] };
  }

  const payload = (await response.json()) as HyperStatsResponse;

  return {
    lastUpdated: payload.lastUpdated ?? null,
    traders: (payload.traders ?? []).map((trader, index) => ({
      address: trader.address ?? "",
      grade: trader.grade ?? "",
      mainToken: trader.mainToken ?? null,
      name: formatAddress(trader.address),
      pnl30d: toNumber(trader.pnl30d?.amount) ?? 0,
      pnl30dPercent: trader.pnl30d?.percentage ?? 0,
      positions: trader.activePositions ?? 0,
      rank: trader.rank ?? index + 1,
      trades: trader.totalTrades ?? 0,
      winRate: trader.winRate ? trader.winRate * 100 : 0,
    })),
  };
}

async function fetchSecLatestFiling(cik: string) {
  const response = await fetch(
    `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&owner=exclude&output=atom&count=5`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/atom+xml,text/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "MarketBubble marketbubble@example.com",
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const parsed = secParser.parse(await response.text()) as SecFeed;
  const entries = parsed.feed?.entry
    ? Array.isArray(parsed.feed.entry)
      ? parsed.feed.entry
      : [parsed.feed.entry]
    : [];
  const entry = entries.find((item) => item.content?.["accession-number"]);
  const accession = entry?.content?.["accession-number"];

  if (!accession) {
    return null;
  }

  return {
    accession,
    accessionPath: accession.replaceAll("-", ""),
    filingDate: entry.content?.["filing-date"] ?? null,
  };
}

async function fetchSecInformationTable(cik: string, accessionPath: string) {
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionPath}`;
  const indexResponse = await fetch(`${baseUrl}/index.json`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "MarketBubble marketbubble@example.com",
    },
  });

  if (!indexResponse.ok) {
    return [];
  }

  const index = (await indexResponse.json()) as SecIndex;
  const xmlName = (index.directory?.item ?? [])
    .filter((item) => item.name?.endsWith(".xml") && item.name !== "primary_doc.xml")
    .sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0))[0]?.name;

  if (!xmlName) {
    return [];
  }

  const xmlResponse = await fetch(`${baseUrl}/${xmlName}`, {
    cache: "no-store",
    headers: {
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "MarketBubble marketbubble@example.com",
    },
  });

  if (!xmlResponse.ok) {
    return [];
  }

  const parsed = secParser.parse(await xmlResponse.text()) as SecInformationTable;
  const holdings = parsed.informationTable?.infoTable
    ? Array.isArray(parsed.informationTable.infoTable)
      ? parsed.informationTable.infoTable
      : [parsed.informationTable.infoTable]
    : [];
  const byCusip = new Map<string, { cusip: string; issuer: string; value: number }>();

  holdings.forEach((holding) => {
    const cusip = holding.cusip?.trim();
    const value = toNumber(holding.value);

    if (!cusip || value === null) {
      return;
    }

    const current = byCusip.get(cusip);
    byCusip.set(cusip, {
      cusip,
      issuer: holding.nameOfIssuer ?? current?.issuer ?? cusip,
      value: (current?.value ?? 0) + value,
    });
  });

  return [...byCusip.values()].sort((a, b) => b.value - a.value).slice(0, 5);
}

async function fetchTickerForCusip(cusip: string) {
  const alias = tickerAliases.get(cusip.toUpperCase());

  if (alias) {
    return alias;
  }

  const apiKey = process.env.MASSIVE_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    `https://api.massive.com/v3/reference/tickers?cusip=${encodeURIComponent(cusip)}&apiKey=${encodeURIComponent(apiKey)}`,
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

  const payload = (await response.json()) as MassiveTickerResponse;
  return payload.results?.find((result) => result.ticker)?.ticker ?? null;
}

async function fetchYahooChange(ticker: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1m`,
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

  if (!Number.isFinite(price) || !Number.isFinite(previousClose)) {
    return null;
  }

  return getChangePercent(price as number, previousClose as number);
}

async function fetchPortfolio(manager: (typeof portfolioManagers)[number]) {
  const filing = await fetchSecLatestFiling(manager.cik);

  if (!filing) {
    return null;
  }

  const holdings = await fetchSecInformationTable(manager.cik, filing.accessionPath);
  const holdingsWithTickers = await Promise.all(
    holdings.slice(0, 4).map(async (holding) => ({
      ...holding,
      ticker: await fetchTickerForCusip(holding.cusip),
    })),
  );
  const changes = await Promise.all(
    holdingsWithTickers.map((holding) => (holding.ticker ? fetchYahooChange(holding.ticker) : null)),
  );
  const totalValue = holdingsWithTickers.reduce((sum, holding) => sum + holding.value, 0);
  const weightedChange = holdingsWithTickers.reduce((sum, holding, index) => {
    const change = changes[index];

    if (change === null || totalValue <= 0) {
      return sum;
    }

    return sum + change * (holding.value / totalValue);
  }, 0);

  return {
    filingDate: filing.filingDate,
    holdings: holdingsWithTickers.slice(0, 3).map((holding, index) => ({
      issuer: holding.issuer,
      ticker: holding.ticker ?? holding.issuer.slice(0, 5),
      value: holding.value,
      weight: totalValue > 0 ? (holding.value / totalValue) * 100 : 0,
      changePercent: changes[index] ?? null,
    })),
    label: manager.label,
    manager: manager.manager,
    performance: weightedChange,
  };
}

async function fetchPortfolios() {
  const results = await Promise.allSettled(portfolioManagers.map(fetchPortfolio));

  return results
    .map((result) => (result.status === "fulfilled" ? result.value : null))
    .filter((portfolio) => portfolio !== null);
}

async function fetchPolymarketMarkets() {
  const response = await fetch(
    "https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume_24hr&ascending=false&limit=80",
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

  const events = (await response.json()) as GammaEvent[];

  return events
    .filter((event) => event.active && !event.closed)
    .map((event) => {
      const market = chooseMarket(event);
      const volume24h = toNumber(market?.volume24hr) ?? toNumber(event.volume24hr) ?? 0;
      const volume = toNumber(market?.volumeNum) ?? toNumber(market?.volume) ?? toNumber(event.volume) ?? 0;
      const probabilities = getMarketProbability(market);

      return {
        changePercent: (toNumber(market?.oneDayPriceChange) ?? 0) * 100,
        no: probabilities.no,
        question: market?.question ?? event.title,
        url: `https://polymarket.com/event/${encodeURIComponent(event.slug)}`,
        volume,
        volume24h,
        yes: probabilities.yes,
      };
    })
    .sort((a, b) => b.volume24h - a.volume24h || b.volume - a.volume)
    .slice(0, 5);
}

export async function GET() {
  try {
    const [hyperliquid, portfolios, polymarketMarkets] = await Promise.all([
      fetchHyperliquidTraders(),
      fetchPortfolios(),
      fetchPolymarketMarkets(),
    ]);

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      hyperliquid,
      polymarketMarkets,
      portfolios,
      sources: ["HyperStats", "SEC EDGAR", "Massive", "Yahoo Finance", "Polymarket Gamma"],
    }, { headers: smartMoneyCacheHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load smart money data.",
        hyperliquid: { lastUpdated: null, traders: [] },
        polymarketMarkets: [],
        portfolios: [],
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }, status: 500 },
    );
  }
}
