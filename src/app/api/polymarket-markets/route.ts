import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CategoryKey = "crypto" | "ai" | "tech" | "finance";

type GammaTag = {
  label?: string;
  slug?: string;
};

type GammaMarket = {
  acceptingOrders?: boolean;
  active?: boolean;
  bestAsk?: number | string;
  bestBid?: number | string;
  closed?: boolean;
  endDate?: string;
  groupItemTitle?: string;
  icon?: string;
  image?: string;
  lastTradePrice?: number | string;
  liquidity?: number | string;
  liquidityNum?: number | string;
  outcomePrices?: string | string[];
  outcomes?: string | string[];
  question?: string;
  slug?: string;
  volume?: number | string;
  volume24hr?: number | string;
  volumeNum?: number | string;
};

type GammaEvent = {
  endDate?: string;
  icon?: string;
  id: string;
  image?: string;
  liquidity?: number | string;
  liquidityClob?: number | string;
  markets?: GammaMarket[];
  slug: string;
  tags?: GammaTag[];
  title: string;
  volume?: number | string;
  volume24hr?: number | string;
};

const categoryPatterns: Record<CategoryKey, RegExp[]> = {
  crypto: [
    /\bcrypto\b/i,
    /\bbitcoin\b|\bbtc\b/i,
    /\bethereum\b|\beth\b/i,
    /\bsolana\b|\bsol\b/i,
    /\bxrp\b/i,
    /\bdoge\b/i,
    /\bhyperliquid\b|\bhype\b/i,
    /\bbinance\b|\bcoinbase\b|\bkraken\b/i,
    /\btoken\b|\bstablecoin\b|\busdc\b|\btether\b|\bdefi\b|\bblockchain\b/i,
    /\bsaylor\b/i,
  ],
  ai: [
    /\bai\b/i,
    /\bartificial intelligence\b/i,
    /\bopenai\b|\bchatgpt\b/i,
    /\banthropic\b|\bclaude\b/i,
    /\bnvidia\b/i,
    /\bdeepmind\b|\bgemini\b|\bgrok\b/i,
    /\bllm\b|\bmodel\b|\bdata center\b/i,
  ],
  tech: [
    /\btech\b|\btechnology\b/i,
    /\bapple\b|\bgoogle\b|\balphabet\b|\bmicrosoft\b|\bmeta\b/i,
    /\btesla\b|\bspacex\b|\bxai\b|\bstarlink\b|\brobotaxi\b|\boptimus\b/i,
    /\btiktok\b|\bamazon\b/i,
    /\bsemiconductor\b|\bchips?\b/i,
    /\bapp store\b/i,
    /\bhardware\b/i,
  ],
  finance: [
    /\bfed\b|\bfomc\b|\brate cuts?\b|\binterest rates?\b/i,
    /\binflation\b|\bcpi\b|\bgdp\b|\brecession\b/i,
    /\bstocks?\b|\bnasdaq\b|\bs&p\b|\bdow\b/i,
    /\bbanks?\b|\bearnings\b|\bipo\b/i,
    /\bgold\b|\boil\b|\bdollar\b|\btreasury\b/i,
  ],
};

const categoryOrder: CategoryKey[] = ["crypto", "ai", "tech", "finance"];

function parseJsonArray(value: GammaMarket["outcomes"]) {
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

function toNumber(value: number | string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeExternalUrl(value: string | null | undefined, fallback = null) {
  if (!value) {
    return fallback;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function getEventText(event: GammaEvent) {
  return [
    event.title,
    event.slug,
    event.tags?.map((tag) => `${tag.label ?? ""} ${tag.slug ?? ""}`).join(" "),
    event.markets
      ?.filter((market) => market.active && !market.closed)
      .map((market) => market.question)
      .join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function getCategories(event: GammaEvent) {
  const text = getEventText(event);

  return categoryOrder.filter((category) =>
    categoryPatterns[category].some((pattern) => pattern.test(text)),
  );
}

function chooseMarket(event: GammaEvent) {
  const markets = event.markets ?? [];

  return (
    markets.find((market) => market.active && !market.closed && market.acceptingOrders) ??
    markets.find((market) => market.active && !market.closed) ??
    markets[0]
  );
}

function getProbability(market?: GammaMarket) {
  const outcomes = parseJsonArray(market?.outcomes);
  const prices = parseJsonArray(market?.outcomePrices).map(Number);
  const yesIndex = Math.max(
    0,
    outcomes.findIndex((outcome) => outcome.toLowerCase() === "yes"),
  );
  const probability = Number.isFinite(prices[yesIndex]) ? prices[yesIndex] : null;

  if (probability !== null) {
    return {
      label: outcomes[yesIndex] ?? "Yes",
      value: Number((probability * 100).toFixed(1)),
    };
  }

  const fallback =
    toNumber(market?.lastTradePrice) ?? toNumber(market?.bestBid) ?? toNumber(market?.bestAsk);

  return fallback === null
    ? null
    : {
        label: "Yes",
        value: Number((fallback * 100).toFixed(1)),
      };
}

function normalizeEvent(event: GammaEvent) {
  const categories = getCategories(event);

  if (!categories.length) {
    return null;
  }

  const market = chooseMarket(event);
  const probability = getProbability(market);
  const volume24h = toNumber(market?.volume24hr) ?? toNumber(event.volume24hr) ?? 0;
  const volume = toNumber(market?.volumeNum) ?? toNumber(market?.volume) ?? toNumber(event.volume) ?? 0;
  const liquidity =
    toNumber(market?.liquidityNum) ??
    toNumber(market?.liquidity) ??
    toNumber(event.liquidityClob) ??
    toNumber(event.liquidity) ??
    0;

  return {
    categories,
    closesAt: market?.endDate ?? event.endDate ?? null,
    id: event.id,
    image: safeExternalUrl(market?.image ?? event.image ?? event.icon ?? market?.icon),
    liquidity,
    primaryCategory: categories[0],
    probability,
    question: market?.question ?? event.title,
    slug: event.slug,
    title: event.title,
    url: `https://polymarket.com/event/${encodeURIComponent(event.slug)}`,
    volume,
    volume24h,
  };
}

export async function GET() {
  try {
    const response = await fetch(
      "https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume_24hr&ascending=false&limit=500",
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to load Polymarket markets.", markets: [] },
        { status: response.status },
      );
    }

    const events = (await response.json()) as GammaEvent[];
    const markets = events
      .map(normalizeEvent)
      .filter((market) => market !== null)
      .sort((a, b) => b.volume24h - a.volume24h || b.volume - a.volume)
      .slice(0, 48);

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      markets,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load Polymarket markets.",
        markets: [],
      },
      { status: 500 },
    );
  }
}
