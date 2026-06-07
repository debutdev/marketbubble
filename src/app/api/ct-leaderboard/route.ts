import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CtMember = {
  fallbackDescription: string;
  handle: string;
  rank: number;
  tag?: string;
};

type XUserEntity = {
  description?: string;
  followers_count?: number;
  friends_count?: number;
  is_blue_verified?: boolean;
  name?: string;
  normal_followers_count?: number;
  profile_image_url_https?: string;
  screen_name?: string;
  verified?: boolean;
};

type XInitialState = {
  entities?: {
    users?: {
      entities?: Record<string, XUserEntity>;
    };
  };
};

type ParsedRssItem = {
  description?: string | { cdata?: string; "#text"?: string };
  pubDate?: string;
  title?: string;
};

type ParsedRss = {
  rss?: {
    channel?: {
      item?: ParsedRssItem | ParsedRssItem[];
    };
  };
};

type CtProfile = {
  avatarUrl: string | null;
  description: string;
  followers: number;
  handle: string;
  name: string;
  profileUrl: string;
  rank: number;
  recentTweets: string[];
  tag?: string;
  verified: boolean;
};

type CtSignal = {
  handle: string;
  overview: string;
  signal: "bullish" | "bearish";
};

const ctMembers: CtMember[] = [
  {
    fallbackDescription: "Crypto commentator, investor, and longtime CT reference point.",
    handle: "cobie",
    rank: 1,
    tag: "The GOAT",
  },
  {
    fallbackDescription: "Crypto trader and market commentator focused on liquid markets.",
    handle: "CL207",
    rank: 2,
  },
  {
    fallbackDescription: "Helius CEO and Solana infrastructure builder.",
    handle: "mert",
    rank: 3,
  },
  {
    fallbackDescription: "Crypto creator and high-signal CT commentator.",
    handle: "notthreadguy",
    rank: 4,
  },
  {
    fallbackDescription: "Crypto operator and market participant.",
    handle: "chameleon_jeff",
    rank: 5,
  },
  {
    fallbackDescription: "Trader and market educator known for cycle commentary.",
    handle: "Tradermayne",
    rank: 6,
  },
  {
    fallbackDescription: "Macro and crypto trader focused on liquid markets.",
    handle: "ThinkingUSD",
    rank: 7,
  },
  {
    fallbackDescription: "Crypto investor and founder/operator voice on CT.",
    handle: "based16z",
    rank: 8,
  },
  {
    fallbackDescription: "Base builder and onchain ecosystem lead.",
    handle: "jessepollak",
    rank: 9,
  },
  {
    fallbackDescription: "Crypto commentator and market observer.",
    handle: "sershokunin",
    rank: 10,
  },
];

const bullishKeywords = [
  "accumulate",
  "ath",
  "bid",
  "breakout",
  "bull",
  "buy",
  "higher",
  "long",
  "moon",
  "pump",
  "rally",
  "risk on",
  "send",
  "up only",
  "upside",
];

const bearishKeywords = [
  "bear",
  "crash",
  "cautious",
  "downside",
  "dump",
  "hedg",
  "lower",
  "recession",
  "risk off",
  "sell",
  "short",
  "sus",
  "top",
];

const rssParser = new XMLParser({
  cdataPropName: "cdata",
  ignoreAttributes: false,
});

function getKeywordScore(text: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => {
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    return score + (text.match(pattern)?.length ?? 0);
  }, 0);
}

function getFallbackSignal(profile: Pick<CtProfile, "handle" | "recentTweets">): CtSignal {
  if (!profile.recentTweets.length) {
    return {
      handle: profile.handle,
      overview: "Recent tweet data is temporarily unavailable, so the current market stance is marked cautious.",
      signal: "bearish",
    };
  }

  const tweetText = profile.recentTweets.join(" ").toLowerCase();
  const bullishScore = getKeywordScore(tweetText, bullishKeywords);
  const bearishScore = getKeywordScore(tweetText, bearishKeywords);
  const signal = bullishScore > bearishScore ? "bullish" : "bearish";

  return {
    handle: profile.handle,
    overview:
      signal === "bullish"
        ? "Recent tweets include more constructive market language than risk-off language, so the stance reads bullish."
        : "Recent tweets do not show a clear risk-on market stance, so the stance reads bearish or cautious.",
    signal,
  };
}

function isCtSignal(value: CtSignal | undefined): value is CtSignal {
  return Boolean(value);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, codePoint: string) =>
      String.fromCodePoint(Number(codePoint)),
    )
    .replace(/&#x([a-f0-9]+);/gi, (_, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    );
}

function findJsonObjectEnd(source: string, startIndex: number) {
  let depth = 0;
  let escaped = false;
  let inString = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function parseInitialState(html: string): XInitialState | null {
  const marker = "window.__INITIAL_STATE__=";
  const markerIndex = html.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const objectStart = html.indexOf("{", markerIndex + marker.length);

  if (objectStart === -1) {
    return null;
  }

  const objectEnd = findJsonObjectEnd(html, objectStart);

  if (objectEnd === -1) {
    return null;
  }

  try {
    return JSON.parse(html.slice(objectStart, objectEnd + 1)) as XInitialState;
  } catch {
    return null;
  }
}

function normalizeAvatarUrl(avatarUrl?: string) {
  if (!avatarUrl) {
    return null;
  }

  try {
    const url = new URL(avatarUrl.replace("_normal.", "_400x400."));

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getDescriptionHtml(description: ParsedRssItem["description"]) {
  if (typeof description === "string") {
    return description;
  }

  return description?.cdata ?? description?.["#text"] ?? "";
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

async function getRecentTweets(handle: string) {
  try {
    const response = await fetch(`https://nitter.net/${encodeURIComponent(handle)}/rss`, {
      cache: "no-store",
      headers: {
        Accept: "application/rss+xml,text/xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return [];
    }

    const parsed = rssParser.parse(await response.text()) as ParsedRss;
    const rawItems = parsed.rss?.channel?.item
      ? Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item
        : [parsed.rss.channel.item]
      : [];

    return rawItems
      .map((item) => stripHtml(getDescriptionHtml(item.description) || item.title || ""))
      .map((tweet) => tweet.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

function getFallbackProfile(member: CtMember): CtProfile {
  return {
    avatarUrl: null,
    description: member.fallbackDescription,
    followers: 0,
    handle: member.handle,
    name: member.handle,
    profileUrl: `https://x.com/${member.handle}`,
    rank: member.rank,
    recentTweets: [],
    tag: member.tag,
    verified: false,
  };
}

async function getXProfile(member: CtMember): Promise<CtProfile> {
  try {
    const response = await fetch(`https://x.com/${encodeURIComponent(member.handle)}`, {
      cache: "no-store",
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return getFallbackProfile(member);
    }

    const state = parseInitialState(await response.text());
    const users = state?.entities?.users?.entities ?? {};
    const user = Object.values(users).find(
      (candidate) => candidate.screen_name?.toLowerCase() === member.handle.toLowerCase(),
    );

    if (!user?.screen_name) {
      return getFallbackProfile(member);
    }

    return {
      avatarUrl: normalizeAvatarUrl(user.profile_image_url_https),
      description: decodeHtmlEntities(user.description || member.fallbackDescription),
      followers: Number(user.normal_followers_count ?? user.followers_count ?? 0),
      handle: user.screen_name,
      name: decodeHtmlEntities(user.name ?? user.screen_name),
      profileUrl: `https://x.com/${user.screen_name}`,
      rank: member.rank,
      recentTweets: [],
      tag: member.tag,
      verified: Boolean(user.is_blue_verified || user.verified),
    };
  } catch {
    return getFallbackProfile(member);
  }
}

async function getCtProfile(member: CtMember) {
  const [profile, recentTweets] = await Promise.all([
    getXProfile(member),
    getRecentTweets(member.handle),
  ]);

  return {
    ...profile,
    recentTweets,
  };
}

function getFallbackSignals(profiles: CtProfile[]) {
  return profiles.map(getFallbackSignal);
}

function sanitizeAiSignals(value: unknown, profiles: CtProfile[]) {
  if (!Array.isArray(value)) {
    return getFallbackSignals(profiles);
  }

  const fallbackByHandle = new Map(getFallbackSignals(profiles).map((signal) => [signal.handle.toLowerCase(), signal]));
  const profileByHandle = new Map(profiles.map((profile) => [profile.handle.toLowerCase(), profile]));
  const aiByHandle = new Map<string, CtSignal>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Partial<CtSignal>;
    const handle = String(record.handle ?? "").replace(/^@/, "");
    const fallback = fallbackByHandle.get(handle.toLowerCase());
    const profile = profileByHandle.get(handle.toLowerCase());

    if (!fallback) {
      continue;
    }

    const signal = record.signal === "bearish" ? "bearish" : "bullish";
    const rawOverview =
      record.overview ??
      (record as { explanation?: string }).explanation ??
      (record as { rationale?: string }).rationale ??
      (record as { reason?: string }).reason ??
      (record as { summary?: string }).summary ??
      fallback.overview;
    const overview = String(rawOverview).replace(/\s+/g, " ").trim();
    const staleUnavailableCopy = /unavailable|defaults cautious|tweet feed/i.test(overview);

    aiByHandle.set(handle.toLowerCase(), {
      handle: fallback.handle,
      overview:
        profile?.recentTweets.length && staleUnavailableCopy
          ? fallback.overview
          : overview.slice(0, 180) || fallback.overview,
      signal,
    });
  }

  return profiles.map(
    (profile) =>
      aiByHandle.get(profile.handle.toLowerCase()) ??
      fallbackByHandle.get(profile.handle.toLowerCase()) ??
      getFallbackSignal(profile),
  );
}

async function getGrokSignals(profiles: CtProfile[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { model: null, signals: getFallbackSignals(profiles), source: "local-fallback" };
  }

  const model = process.env.OPENROUTER_MODEL ?? "x-ai/grok-4.3";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    body: JSON.stringify({
      messages: [
        {
          content:
            "You are MarketBubble's crypto-twitter analyst. For each account, decide whether their RECENT TWEETS show they are currently bullish or bearish on crypto/markets/risk assets. Bullish means constructive, risk-on, buying, upside, ecosystem optimism, or pro-market stance. Bearish means cautious, risk-off, downside, selling, skepticism, or no clear bullish market stance in the provided tweets. Base the answer only on recentTweets, not reputation or profile bio. If recentTweets is empty, mark bearish and say recent tweet data is unavailable. Return strict JSON only: {\"signals\":[{\"handle\":\"...\",\"signal\":\"bullish|bearish\",\"overview\":\"one sentence based on tweet text\"}]}",
          role: "system",
        },
        {
          content: JSON.stringify(
            profiles.map((profile) => ({
              description: profile.description,
              followers: profile.followers,
              handle: profile.handle,
              name: profile.name,
              rank: profile.rank,
              recentTweets: profile.recentTweets,
              tag: profile.tag ?? null,
            })),
          ),
          role: "user",
        },
      ],
      model,
      response_format: { type: "json_object" },
      temperature: 0.35,
    }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://marketbubble.vercel.app",
      "X-Title": "Market Bubble",
    },
    method: "POST",
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    return { model, signals: getFallbackSignals(profiles), source: "local-fallback" };
  }

  const payload = await response.json();
  const rawContent = payload?.choices?.[0]?.message?.content;

  if (typeof rawContent !== "string") {
    return { model, signals: getFallbackSignals(profiles), source: "local-fallback" };
  }

  try {
    const parsed = JSON.parse(rawContent) as { signals?: unknown };
    const signals = sanitizeAiSignals(parsed.signals ?? parsed, profiles);

    return { model, signals, source: "openrouter" };
  } catch {
    return { model, signals: getFallbackSignals(profiles), source: "local-fallback" };
  }
}

export async function GET() {
  const profiles = await Promise.all(ctMembers.map(getCtProfile));
  const signalResult = await getGrokSignals(profiles);
  const signalByHandle = new Map<string, CtSignal>();

  for (const signal of signalResult.signals) {
    if (isCtSignal(signal)) {
      signalByHandle.set(signal.handle.toLowerCase(), signal);
    }
  }

  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      members: profiles.map((profile) => ({
        ...profile,
        signal: signalByHandle.get(profile.handle.toLowerCase()) ?? getFallbackSignal(profile),
      })),
      signalModel: signalResult.model,
      signalSource: signalResult.source,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200",
      },
    },
  );
}
