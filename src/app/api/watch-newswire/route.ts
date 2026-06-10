import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NewswireItem = {
  avatar?: string;
  handle?: string;
  id: string;
  kind: "tweet" | "news";
  name: string;
  source: string;
  text: string;
  ts: number;
  url: string;
};

type RssFeed = {
  source: string;
  url: string;
};

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const nitterFeedHost = "https://nitter.net";
const tweetBatchSize = 10;
const tweetAccounts = [
  "MarketBubble",
  "blknoiz06",
  "Banks",
  "Polymarket",
  "WatcherGuru",
  "DocumentingBTC",
  "tier10k",
  "Cointelegraph",
  "CoinDesk",
  "TheBlock__",
  "whale_alert",
  "lookonchain",
  "unusual_whales",
  "DeItaone",
  "cobie",
  "HsakaTrades",
  "GiganticRebirth",
  "inversebrah",
  "0xMert_",
  "Pentosh1",
  "CryptoHayes",
  "saylor",
  "VitalikButerin",
  "cz_binance",
  "APompliano",
  "RaoulGMI",
  "AltcoinGordon",
  "milesdeutscher",
  "notthreadguy",
  "Rewkang",
  "WuBlockchain",
];
const rssFeeds: RssFeed[] = [
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
  { source: "Blockworks", url: "https://blockworks.co/feed/" },
  { source: "CryptoSlate", url: "https://cryptoslate.com/feed/" },
  { source: "BeInCrypto", url: "https://beincrypto.com/feed/" },
];

function safeChar(code: number) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => safeChar(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => safeChar(parseInt(code, 16)));
}

function cleanText(value: string) {
  return decodeEntities(value)
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toTimestamp(value: string | undefined) {
  if (!value) {
    return Date.now();
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function safeExternalUrl(value: string | undefined, fallback = "") {
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

async function fetchText(url: string) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 9000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,*/*",
        "User-Agent": userAgent,
      },
      redirect: "follow",
      signal: abortController.signal,
    });

    if (!response.ok) {
      return "";
    }

    return response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTweets(handle: string): Promise<NewswireItem[]> {
  const html = await fetchText(
    `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`,
  );

  if (!html) {
    return fetchNitterTweets(handle);
  }

  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

  if (!match?.[1]) {
    return fetchNitterTweets(handle);
  }

  let data: unknown;

  try {
    data = JSON.parse(match[1]);
  } catch {
    return fetchNitterTweets(handle);
  }

  const entries = getTimelineEntries(data);
  const items: NewswireItem[] = [];

  for (const entry of entries) {
    const tweet = entry?.content?.tweet;

    if (!tweet?.id_str || tweet.in_reply_to_status_id_str) {
      continue;
    }

    const retweet = tweet.retweeted_status;
    const baseText = retweet?.full_text
      ? `RT @${retweet.user?.screen_name ?? "unknown"}: ${retweet.full_text}`
      : tweet.full_text ?? "";
    const text = cleanText(baseText);

    if (!text) {
      continue;
    }

    const tweetHandle = String(tweet.user?.screen_name ?? handle);
    const avatar = String(tweet.user?.profile_image_url_https ?? tweet.user?.profile_image_url ?? "");

    items.push({
      avatar: avatar ? safeExternalUrl(avatar.replace("_normal", "_bigger")) : undefined,
      handle: tweetHandle,
      id: `tweet:${tweet.id_str}`,
      kind: "tweet",
      name: String(tweet.user?.name ?? tweetHandle),
      source: "X",
      text: text.length > 420 ? `${text.slice(0, 417)}...` : text,
      ts: toTimestamp(String(tweet.created_at ?? "")),
      url: safeExternalUrl(
        `https://x.com${tweet.permalink ?? `/${tweetHandle}/status/${tweet.id_str}`}`,
        "https://x.com",
      ),
    });
  }

  return items.length ? items : fetchNitterTweets(handle);
}

function getTimelineEntries(data: unknown) {
  const payload = data as {
    props?: {
      pageProps?: {
        timeline?: {
          entries?: Array<{
            content?: {
              tweet?: {
                created_at?: string;
                full_text?: string;
                id_str?: string;
                in_reply_to_status_id_str?: string;
                permalink?: string;
                retweeted_status?: {
                  full_text?: string;
                  user?: {
                    screen_name?: string;
                  };
                };
                user?: {
                  name?: string;
                  profile_image_url?: string;
                  profile_image_url_https?: string;
                  screen_name?: string;
                };
              };
            };
          }>;
        };
      };
    };
  };

  return payload.props?.pageProps?.timeline?.entries ?? [];
}

function getRssTag(block: string, tagName: string) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));

  if (!match?.[1]) {
    return "";
  }

  const cdata = match[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const value = cdata?.[1] ?? match[1];

  return cleanText(value.replace(/<[^>]+>/g, ""));
}

async function fetchRss(feed: RssFeed): Promise<NewswireItem[]> {
  const xml = await fetchText(feed.url);

  if (!xml) {
    return [];
  }

  return (xml.match(/<item[\s\S]*?<\/item>/gi) ?? [])
    .slice(0, 10)
    .flatMap((block) => {
      const title = getRssTag(block, "title");

      if (!title) {
        return [];
      }

      const fallbackLink = block.match(/<link[^>]*href="([^"]+)"/i)?.[1];
      const link = safeExternalUrl(getRssTag(block, "link") || fallbackLink);
      const publishedAt =
        getRssTag(block, "pubDate") || getRssTag(block, "dc:date") || getRssTag(block, "published");

      return {
        id: `news:${link || `${feed.source}:${title}`}`,
        kind: "news",
        name: feed.source,
        source: feed.source,
        text: title.length > 420 ? `${title.slice(0, 417)}...` : title,
        ts: toTimestamp(publishedAt),
        url: link || feed.url,
      };
    });
}

async function fetchNitterTweets(handle: string): Promise<NewswireItem[]> {
  const xml = await fetchText(`${nitterFeedHost}/${handle}/rss`);

  if (!xml) {
    return [];
  }

  return (xml.match(/<item[\s\S]*?<\/item>/gi) ?? [])
    .slice(0, 4)
    .flatMap((block) => {
      const title = getRssTag(block, "title").replace(`RT by @${handle}:`, "").trim();
      const description = getRssTag(block, "description");
      const text = cleanText(description || title);
      const link = getRssTag(block, "link");
      const guid = getRssTag(block, "guid") || link || `${handle}:${title}`;

      if (!text || !guid) {
        return [];
      }

      const author = getRssTag(block, "dc:creator").replace(/^@/, "") || handle;
      const xUrl = safeExternalUrl(
        link.replace(nitterFeedHost, "https://x.com").replace(/#m$/, ""),
        `https://x.com/${handle}`,
      );

      return {
        handle: author,
        id: `tweet:${guid}`,
        kind: "tweet",
        name: author,
        source: "X",
        text: text.length > 420 ? `${text.slice(0, 417)}...` : text,
        ts: toTimestamp(getRssTag(block, "pubDate")),
        url: xUrl,
      };
    });
}

function getRotatingTweetAccounts() {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const start = (minuteBucket * tweetBatchSize) % tweetAccounts.length;

  return Array.from({ length: tweetBatchSize }, (_, index) => {
    return tweetAccounts[(start + index) % tweetAccounts.length];
  });
}

export async function GET() {
  const handles = getRotatingTweetAccounts();
  const settled = await Promise.allSettled([
    ...handles.map((handle) => fetchTweets(handle)),
    ...rssFeeds.map((feed) => fetchRss(feed)),
  ]);
  const items = settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => b.ts - a.ts);
  const uniqueItems = Array.from(
    items
      .reduce((map, item) => {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }

        return map;
      }, new Map<string, NewswireItem>())
      .values(),
  ).slice(0, 40);

  return NextResponse.json({
    error: uniqueItems.length ? undefined : "No live news items were available.",
    fetchedAt: new Date().toISOString(),
    items: uniqueItems,
    sources: {
      rss: rssFeeds.map((feed) => feed.source),
      x: handles,
    },
  });
}
