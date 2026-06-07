import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CtMember = {
  fallbackDescription: string;
  handle: string;
  rank: number;
  tag?: string;
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

type CtArchiveMember = Partial<CtProfile>;

type CtArchive = {
  fetchedAt?: string;
  members?: CtArchiveMember[];
  source?: string;
};

type CtSignal = {
  handle: string;
  overview: string;
  signal: "bullish" | "bearish";
};

type SignalResult = {
  model: string | null;
  signals: CtSignal[];
  source: "openrouter" | "local-fallback";
};

type CtLeaderboardPayload = {
  fetchedAt: string;
  members: Array<CtProfile & { signal: CtSignal }>;
  signalModel: string | null;
  signalSource: SignalResult["source"];
};

type CachedLeaderboard = {
  cachedAt: number;
  payload: CtLeaderboardPayload;
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

const browserCacheSeconds = 60;
const freshCacheMs = 30 * 60 * 1000;
const staleCacheMs = 6 * 60 * 60 * 1000;

let cachedLeaderboard: CachedLeaderboard | null = null;
let refreshPromise: Promise<CtLeaderboardPayload> | null = null;

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

async function getCtArchive() {
  try {
    const archivePath = join(process.cwd(), "public", "data", "ct-leaderboard.json");
    const archive = JSON.parse(await readFile(archivePath, "utf8")) as CtArchive;
    const members = archive.members ?? [];

    return new Map(
      members
        .filter((member) => member.handle)
        .map((member) => [String(member.handle).toLowerCase(), member]),
    );
  } catch {
    return new Map<string, CtArchiveMember>();
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

function getArchivedProfile(member: CtMember, archived?: CtArchiveMember): CtProfile | null {
  if (!archived) {
    return null;
  }

  const handle = archived.handle || member.handle;

  return {
    avatarUrl: archived.avatarUrl ?? null,
    description: archived.description || member.fallbackDescription,
    followers: Number(archived.followers ?? 0),
    handle,
    name: archived.name || handle,
    profileUrl: archived.profileUrl || `https://x.com/${handle}`,
    rank: member.rank,
    recentTweets: (archived.recentTweets ?? []).filter(Boolean).slice(0, 8),
    tag: member.tag ?? archived.tag,
    verified: Boolean(archived.verified),
  };
}

async function getArchivedProfiles() {
  const archive = await getCtArchive();

  return ctMembers.map(
    (member) => getArchivedProfile(member, archive.get(member.handle.toLowerCase())) ?? getFallbackProfile(member),
  );
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

async function getGrokSignals(profiles: CtProfile[]): Promise<SignalResult> {
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

function createLeaderboardPayload(profiles: CtProfile[], signalResult: SignalResult): CtLeaderboardPayload {
  const signalByHandle = new Map<string, CtSignal>();

  for (const signal of signalResult.signals) {
    if (isCtSignal(signal)) {
      signalByHandle.set(signal.handle.toLowerCase(), signal);
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    members: profiles.map((profile) => ({
      ...profile,
      signal: signalByHandle.get(profile.handle.toLowerCase()) ?? getFallbackSignal(profile),
    })),
    signalModel: signalResult.model,
    signalSource: signalResult.source,
  };
}

async function buildLocalPayload() {
  const profiles = await getArchivedProfiles();

  return createLeaderboardPayload(profiles, {
    model: null,
    signals: getFallbackSignals(profiles),
    source: "local-fallback",
  });
}

async function buildAiPayload() {
  const profiles = await getArchivedProfiles();
  const signalResult = await getGrokSignals(profiles);

  return createLeaderboardPayload(profiles, signalResult);
}

function refreshLeaderboardCache() {
  if (!refreshPromise) {
    refreshPromise = buildAiPayload()
      .then((payload) => {
        cachedLeaderboard = {
          cachedAt: Date.now(),
          payload,
        };

        return payload;
      })
      .catch(async () => {
        const payload = await buildLocalPayload();

        cachedLeaderboard = {
          cachedAt: Date.now(),
          payload,
        };

        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function startBackgroundRefresh() {
  void refreshLeaderboardCache();
}

function leaderboardResponse(payload: CtLeaderboardPayload, cacheStatus: "HIT" | "MISS" | "STALE") {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": `public, max-age=${browserCacheSeconds}, s-maxage=1800, stale-while-revalidate=7200`,
      "X-MarketBubble-Cache": cacheStatus,
    },
  });
}

export async function GET() {
  const now = Date.now();

  if (cachedLeaderboard) {
    const cacheAge = now - cachedLeaderboard.cachedAt;

    if (cacheAge < freshCacheMs) {
      return leaderboardResponse(cachedLeaderboard.payload, "HIT");
    }

    if (cacheAge < staleCacheMs) {
      startBackgroundRefresh();
      return leaderboardResponse(cachedLeaderboard.payload, "STALE");
    }
  }

  const payload = await buildLocalPayload();
  cachedLeaderboard = {
    cachedAt: Date.now(),
    payload,
  };
  startBackgroundRefresh();

  return leaderboardResponse(payload, "MISS");
}
