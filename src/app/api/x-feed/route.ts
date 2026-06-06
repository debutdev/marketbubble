import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";
import { URL } from "node:url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ParsedRssItem = {
  "dc:creator"?: string;
  description?: string | { cdata?: string; "#text"?: string };
  guid?: string | { "#text"?: string };
  link?: string;
  pubDate?: string;
  title?: string;
};

type ParsedRss = {
  rss?: {
    channel?: {
      image?: {
        url?: string;
      };
      item?: ParsedRssItem | ParsedRssItem[];
      title?: string;
    };
  };
};

const parser = new XMLParser({
  cdataPropName: "cdata",
  ignoreAttributes: false,
});

const feedHosts = ["https://nitter.net"];
const allowedFeedRedirectHosts = new Set(["nitter.net"]);
const fallbackFetchedAt = "2026-06-06T01:22:31.000Z";
const fallbackTweets = [
  {
    author: "@MarketBubble",
    id: "2063068989304025419",
    isRetweet: false,
    media: ["https://nitter.net/pic/media%2FHKF3ZcNXEAAu-AB.jpg"],
    publishedAt: "2026-06-06T01:22:31.000Z",
    text:
      "Ansem is up +450% in two weeks, leading the Bullpen trading comp by nearly $100k. $25K -> $137K, with every trade called live on the show.",
    title:
      "Ansem is up +450% in two weeks, leading the Bullpen trading comp by nearly $100k",
    url: "https://x.com/MarketBubble/status/2063068989304025419",
  },
  {
    author: "@MarketBubble",
    id: "2063053008607584693",
    isRetweet: false,
    media: [
      "https://nitter.net/pic/amplify_video_thumb%2F2063052909273923584%2Fimg%2FiORz10qL1CjLl-pH.jpg",
    ],
    publishedAt: "2026-06-06T00:19:01.000Z",
    text:
      "Mike Majlak reveals Logan Paul is already up about $20,000 on his $50,000 Knicks position before Game 1.",
    title: "Mike Majlak reveals Logan Paul is already up on his Knicks position",
    url: "https://x.com/MarketBubble/status/2063053008607584693",
  },
  {
    author: "@MarketBubble",
    id: "2063010822012506125",
    isRetweet: false,
    media: [
      "https://nitter.net/pic/amplify_video_thumb%2F2063006809250582528%2Fimg%2F7Eyxq9KvvkWuRBSm.jpg",
    ],
    publishedAt: "2026-06-05T21:31:23.000Z",
    text:
      "Erik Voorhees explains how Venice's dual token model works, including staking, burns, DIEM, and AI inference access.",
    title: "Erik Voorhees explains how Venice's dual token model actually works",
    url: "https://x.com/MarketBubble/status/2063010822012506125",
  },
  {
    author: "@MarketBubble",
    id: "2062981930841235641",
    isRetweet: false,
    media: [
      "https://nitter.net/pic/amplify_video_thumb%2F2062976446901989376%2Fimg%2Fhj9qWDJUJU3MXhWv.jpg",
    ],
    publishedAt: "2026-06-05T19:36:35.000Z",
    text:
      "Ansem called the market crash live, explaining why a break under range lows could liquidate longs and pull the market down.",
    title: "Ansem called the market crash live on last night's show",
    url: "https://x.com/MarketBubble/status/2062981930841235641",
  },
  {
    author: "@MarketBubble",
    id: "2062932484900196624",
    isRetweet: false,
    media: [
      "https://nitter.net/pic/amplify_video_thumb%2F2062929683881050112%2Fimg%2FPin3PGfKt766PbrJ.jpg",
    ],
    publishedAt: "2026-06-05T16:20:06.000Z",
    text:
      "Erik Voorhees revisits debating SBF before FTX collapsed and the fallout that exposed the fraud.",
    title: "Erik Voorhees reveals he debated SBF right before FTX collapsed",
    url: "https://x.com/MarketBubble/status/2062932484900196624",
  },
  {
    author: "@Jackkk",
    id: "2062700872099143867",
    isRetweet: true,
    media: [
      "https://nitter.net/pic/amplify_video_thumb%2F2062700644461670400%2Fimg%2FMSQQuSEz9TxtP0sm.jpg",
    ],
    publishedAt: "2026-06-05T00:59:45.000Z",
    text:
      "Flood explains why he skipped Thanksgiving to buy Hyperliquid at launch and how early HYPE traded.",
    title: "Flood reveals he missed Thanksgiving to buy Hyperliquid at launch",
    url: "https://x.com/Jackkk/status/2062700872099143867",
  },
  {
    author: "@Jackkk",
    id: "2062666736495952368",
    isRetweet: true,
    media: [
      "https://nitter.net/pic/amplify_video_thumb%2F2062666670007799808%2Fimg%2FKAMzm_4tA7hfwTZv.jpg",
    ],
    publishedAt: "2026-06-04T22:44:07.000Z",
    text: "Mike Majlak crashes out on FaZe Banks and Ansem after a marathon show segment.",
    title: "Mike Majlak crashes out on FaZe Banks and Ansem",
    url: "https://x.com/Jackkk/status/2062666736495952368",
  },
  {
    author: "@MarketBubble",
    id: "2062708805947805754",
    isRetweet: false,
    media: [
      "https://nitter.net/pic/amplify_video_thumb%2F2062704375768788992%2Fimg%2FkqakR6FzH5-jCwK-.jpg",
    ],
    publishedAt: "2026-06-05T01:31:17.000Z",
    text:
      "Erik Voorhees talks through the censorship risk he sees coming for AI and online information access.",
    title: "Erik Voorhees on the censorship risk he sees coming for AI",
    url: "https://x.com/MarketBubble/status/2062708805947805754",
  },
];

function safeExternalUrl(value: string, fallback = "") {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

async function fetchText(url: string, redirectCount = 0): Promise<string> {
  const requestUrl = new URL(url);
  const response = await fetch(requestUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/rss+xml,text/xml;q=0.9,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(18_000),
  });
  const location = response.headers.get("location");

  if (response.status >= 300 && response.status < 400 && location && redirectCount < 3) {
    const redirectUrl = new URL(location, requestUrl);

    if (redirectUrl.protocol !== "https:" || !allowedFeedRedirectHosts.has(redirectUrl.hostname)) {
      throw new Error("Blocked X feed redirect outside the allowed hosts.");
    }

    return fetchText(redirectUrl.toString(), redirectCount + 1);
  }

  if (!response.ok) {
    throw new Error(`X feed returned ${response.status}.`);
  }

  return response.text();
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

function getDescriptionHtml(description: ParsedRssItem["description"]) {
  if (typeof description === "string") {
    return description;
  }

  return description?.cdata ?? description?.["#text"] ?? "";
}

function getGuid(guid: ParsedRssItem["guid"], link = "") {
  if (typeof guid === "string") {
    return guid;
  }

  const parsedGuid = guid?.["#text"];

  if (parsedGuid) {
    return parsedGuid;
  }

  return link.match(/status\/(\d+)/)?.[1] ?? link;
}

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function extractMedia(html: string) {
  return Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/gi))
    .map((match) => safeExternalUrl(decodeHtml(match[1] ?? "")))
    .filter(Boolean);
}

function toXStatusUrl(link: string, author: string, id: string) {
  const cleanAuthor = author.replace(/^@/, "").replace(/[^\w]/g, "");
  const statusId = id || link.match(/status\/(\d+)/)?.[1];

  if (cleanAuthor && statusId) {
    return `https://x.com/${encodeURIComponent(cleanAuthor)}/status/${encodeURIComponent(statusId)}`;
  }

  return safeExternalUrl(link.replace("https://nitter.net", "https://x.com").replace(/#m$/, ""), "https://x.com");
}

function getFallbackFeed(handle: string, error?: string) {
  return {
    error,
    fallback: true,
    fetchedAt: fallbackFetchedAt,
    handle,
    profileImageUrl: null,
    profileTitle: `@${handle}`,
    tweets: fallbackTweets,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = (searchParams.get("handle") ?? "MarketBubble")
    .replace(/^@/, "")
    .replace(/[^\w]/g, "");

  try {
    let xml = "";
    let feedError: unknown = null;

    for (const feedHost of feedHosts) {
      try {
        xml = await fetchText(`${feedHost}/${handle}/rss`);

        if (xml.trim()) {
          break;
        }
      } catch (error) {
        feedError = error;
      }
    }

    if (!xml.trim()) {
      return NextResponse.json(
        getFallbackFeed(
          handle,
          feedError instanceof Error ? feedError.message : "The public feed returned no items.",
        ),
      );
    }

    const parsed = parser.parse(xml) as ParsedRss;
    const channel = parsed.rss?.channel;
    const rawItems = channel?.item
      ? Array.isArray(channel.item)
        ? channel.item
        : [channel.item]
      : [];

    const tweets = rawItems.map((item) => {
      const descriptionHtml = getDescriptionHtml(item.description);
      const author = item["dc:creator"] ?? `@${handle}`;
      const link = item.link ?? "";
      const id = getGuid(item.guid, link);
      const title = item.title ?? "";

      return {
        author,
        id,
        isRetweet: title.startsWith(`RT by @${handle}:`),
        media: extractMedia(descriptionHtml),
        nitterUrl: safeExternalUrl(link),
        publishedAt: item.pubDate ?? "",
        text: stripHtml(descriptionHtml || title.replace(`RT by @${handle}:`, "")),
        title: decodeHtml(title),
        url: toXStatusUrl(link, author, id),
      };
    });

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      handle,
      profileImageUrl: channel?.image?.url ?? null,
      profileTitle: channel?.title ?? `@${handle}`,
      tweets,
    });
  } catch (error) {
    return NextResponse.json(
      getFallbackFeed(handle, error instanceof Error ? error.message : "Unable to load X feed."),
    );
  }
}
