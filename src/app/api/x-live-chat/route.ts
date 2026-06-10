import { NextResponse } from "next/server";
import type { CommunityChatEvent } from "@/lib/community-top-chat-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type XFeedTweet = {
  author?: string;
  id?: string;
  publishedAt?: string;
  text?: string;
  title?: string;
  url?: string;
};

type XFeedPayload = {
  fallback?: boolean;
  handle?: string;
  liveCount?: number;
  tweets?: XFeedTweet[];
};

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

const authorColors = [
  "#a970ff",
  "#ff7a9a",
  "#45d483",
  "#4fa7ff",
  "#ffb347",
  "#72e0d1",
  "#d889ff",
  "#ff6f61",
  "#c7e85f",
  "#7aa7ff",
  "#f0d35f",
  "#ff8fd6",
];

function normalizeHandle(value: string) {
  return value.replace(/^@/, "").replace(/[^\w]/g, "").slice(0, 32);
}

function getRequestedHandles(searchParams: URLSearchParams) {
  const values = [
    ...searchParams.getAll("handle"),
    ...searchParams.getAll("xHandle"),
  ].flatMap((value) => value.split(","));
  const handles = values
    .map((value) => normalizeHandle(value.trim()))
    .filter(Boolean);

  return Array.from(new Set(handles.length > 0 ? handles : ["MarketBubble"])).slice(
    0,
    8,
  );
}

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 32;
  }

  return Math.max(1, Math.min(parsed, 96));
}

function getAuthorColor(author: string) {
  const colorIndex =
    [...author].reduce((hash, character) => hash + character.charCodeAt(0), 0) %
    authorColors.length;

  return authorColors[colorIndex];
}

function getTweetTimestamp(tweet: XFeedTweet) {
  const timestamp = new Date(tweet.publishedAt ?? "").getTime();

  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function getTweetText(tweet: XFeedTweet) {
  const text = tweet.text?.replace(/\s+/g, " ").trim();
  const title = tweet.title?.replace(/\s+/g, " ").trim();

  return text || title || "";
}

function getTweetAuthor(tweet: XFeedTweet, handle: string) {
  return (tweet.author ?? `@${handle}`)
    .replace(/^@/, "")
    .replace(/[^\w-]/g, "")
    .slice(0, 48);
}

async function fetchXFeed(requestUrl: string, handle: string) {
  const feedUrl = new URL("/api/x-feed", requestUrl);

  feedUrl.searchParams.set("handle", handle);

  const response = await fetch(feedUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(18_000),
  });

  if (!response.ok) {
    throw new Error(`X feed returned ${response.status}.`);
  }

  return (await response.json()) as XFeedPayload;
}

function mapTweetToEvent(handle: string, tweet: XFeedTweet): CommunityChatEvent | null {
  const source = tweet.id || tweet.url;
  const text = getTweetText(tweet);

  if (!source || !text) {
    return null;
  }

  const author = getTweetAuthor(tweet, handle);

  if (!author) {
    return null;
  }

  return {
    author,
    channel: handle.toLowerCase(),
    color: getAuthorColor(author),
    platform: "X",
    receivedAt: getTweetTimestamp(tweet),
    sourceId: `x:${handle.toLowerCase()}:${source}`,
    text: text.slice(0, 260),
  };
}

export async function GET(request: Request) {
  const requestUrl = request.url;
  const { searchParams } = new URL(requestUrl);
  const handles = getRequestedHandles(searchParams);
  const limit = normalizeLimit(searchParams.get("limit"));
  const lookbackHours = Number.parseFloat(searchParams.get("lookbackHours") ?? "168");
  const lookbackMs = Number.isFinite(lookbackHours)
    ? Math.max(1, Math.min(lookbackHours, 24 * 30)) * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000;
  const oldestAllowed = Date.now() - lookbackMs;
  const events: CommunityChatEvent[] = [];
  const warnings: string[] = [];

  await Promise.all(
    handles.map(async (handle) => {
      try {
        const payload = await fetchXFeed(requestUrl, handle);
        const isGenericFallback =
          payload.fallback === true && handle.toLowerCase() !== "marketbubble";

        if (isGenericFallback) {
          warnings.push(`Public X feed fallback skipped for @${handle}.`);
          return;
        }

        for (const tweet of payload.tweets ?? []) {
          const event = mapTweetToEvent(handle, tweet);

          if (!event || event.receivedAt < oldestAllowed) {
            continue;
          }

          events.push(event);
        }
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `@${handle}: ${error.message}`
            : `@${handle}: unable to load X feed.`,
        );
      }
    }),
  );

  const uniqueEvents = Array.from(
    new Map(events.map((event) => [event.sourceId, event])).values(),
  )
    .sort((first, second) => first.receivedAt - second.receivedAt)
    .slice(-limit);

  return NextResponse.json(
    {
      events: uniqueEvents,
      handles,
      reason: warnings.length > 0 ? "public-feed-warning" : undefined,
      stored: false,
      updatedAt: Date.now(),
      warnings,
    },
    { headers: noStoreHeaders },
  );
}
