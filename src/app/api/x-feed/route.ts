import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";
import https from "node:https";
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

const allowedFeedRedirectHosts = new Set(["nitter.net", "xcancel.com"]);

function safeExternalUrl(value: string, fallback = "") {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function fetchText(url: string, redirectCount = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const request = https.request(
      requestUrl,
      {
        headers: {
          Accept: "application/rss+xml,text/xml;q=0.9,*/*;q=0.8",
          "Accept-Encoding": "identity",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        },
        method: "GET",
      },
      (response) => {
        const location = response.headers.location;

        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          location &&
          redirectCount < 3
        ) {
          const redirectUrl = new URL(location, requestUrl);

          if (redirectUrl.protocol !== "https:" || !allowedFeedRedirectHosts.has(redirectUrl.hostname)) {
            reject(new Error("Blocked X feed redirect outside the allowed hosts."));
            response.resume();
            return;
          }

          resolve(fetchText(redirectUrl.toString(), redirectCount + 1));
          response.resume();
          return;
        }

        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      },
    );

    request.on("error", reject);
    request.setTimeout(18_000, () => {
      request.destroy(new Error("X feed request timed out"));
    });
    request.end();
  });
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = (searchParams.get("handle") ?? "MarketBubble")
    .replace(/^@/, "")
    .replace(/[^\w]/g, "");

  try {
    const xml = await fetchText(`https://nitter.net/${handle}/rss`);

    if (!xml.trim()) {
      return NextResponse.json(
        { error: "The public feed returned no items.", handle, tweets: [] },
        { status: 502 },
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
      {
        error: error instanceof Error ? error.message : "Unable to load X feed.",
        handle,
        tweets: [],
      },
      { status: 500 },
    );
  }
}
