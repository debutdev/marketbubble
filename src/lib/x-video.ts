import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ResolvedTweetVideo = {
  aspectRatio: number[] | null;
  durationMs: number | null;
  posterUrl: string;
  sourceVideoUrl: string;
  tweetId: string;
};

type SyndicationVariant = {
  bitrate?: number;
  content_type?: string;
  src?: string;
  type?: string;
  url?: string;
};

type SyndicationMediaDetail = {
  media_url_https?: string;
  type?: string;
  video_info?: {
    aspect_ratio?: number[];
    duration_millis?: number;
    variants?: SyndicationVariant[];
  };
};

type SyndicationTweet = {
  __typename?: string;
  mediaDetails?: SyndicationMediaDetail[];
  video?: {
    aspectRatio?: number[];
    durationMs?: number;
    poster?: string;
    variants?: SyndicationVariant[];
  };
};

type ArchivedTweetVideo = {
  duration?: number | null;
  id?: string;
  media?: string[];
  videoUrl?: string;
};

type XArchive = {
  taggedClips?: ArchivedTweetVideo[];
  tweets?: ArchivedTweetVideo[];
};

export function getTweetId(value: string | null) {
  if (!value) {
    return "";
  }

  const directId = value.match(/^\d{10,25}$/)?.[0];

  if (directId) {
    return directId;
  }

  return value.match(/status\/(\d{10,25})/)?.[1] ?? "";
}

function getSyndicationToken(tweetId: string) {
  return (Number(tweetId) / 1e15 * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

function isSafeMediaUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" && /\.twimg\.com$/.test(url.hostname);
  } catch {
    return false;
  }
}

function getBestMp4Variant(variants: SyndicationVariant[] | undefined) {
  return (variants ?? [])
    .map((variant) => ({
      bitrate: Number(variant.bitrate ?? 0),
      type: variant.type ?? variant.content_type ?? "",
      url: variant.src ?? variant.url ?? "",
    }))
    .filter((variant) => variant.type === "video/mp4" && isSafeMediaUrl(variant.url))
    .sort((a, b) => b.bitrate - a.bitrate)[0];
}

async function resolveArchivedTweetVideo(tweetId: string): Promise<ResolvedTweetVideo | null> {
  try {
    const archivePath = join(process.cwd(), "public", "data", "x-archive", "marketbubble.json");
    const rawArchive = await readFile(archivePath, "utf8");
    const archive = JSON.parse(rawArchive) as XArchive;
    const tweet = [...(archive.tweets ?? []), ...(archive.taggedClips ?? [])].find(
      (item) => String(item.id) === tweetId,
    );

    if (!tweet?.videoUrl || !isSafeMediaUrl(tweet.videoUrl)) {
      return null;
    }

    const posterUrl = (tweet.media ?? []).find((url) => isSafeMediaUrl(url)) ?? "";
    const duration = Number(tweet.duration ?? 0);

    return {
      aspectRatio: null,
      durationMs: Number.isFinite(duration) && duration > 0 ? duration * 1000 : null,
      posterUrl,
      sourceVideoUrl: tweet.videoUrl,
      tweetId,
    };
  } catch {
    return null;
  }
}

export async function resolveTweetVideo(tweetId: string): Promise<ResolvedTweetVideo | null> {
  const token = getSyndicationToken(tweetId);
  let syndicationError: Error | null = null;

  try {
    const response = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(
        tweetId,
      )}&lang=en&token=${encodeURIComponent(token)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json,text/plain,*/*",
          Referer: "https://platform.twitter.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        },
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      throw new Error(`X video lookup returned ${response.status}.`);
    }

    const payload = (await response.json()) as SyndicationTweet;
    const primaryMedia = payload.mediaDetails?.find((media) => media.type === "video");
    const bestVariant =
      getBestMp4Variant(payload.video?.variants) ??
      getBestMp4Variant(primaryMedia?.video_info?.variants);

    if (bestVariant) {
      const posterUrl = isSafeMediaUrl(payload.video?.poster)
        ? payload.video?.poster
        : isSafeMediaUrl(primaryMedia?.media_url_https)
          ? primaryMedia?.media_url_https
          : "";

      return {
        aspectRatio: payload.video?.aspectRatio ?? primaryMedia?.video_info?.aspect_ratio ?? null,
        durationMs: payload.video?.durationMs ?? primaryMedia?.video_info?.duration_millis ?? null,
        posterUrl: posterUrl ?? "",
        sourceVideoUrl: bestVariant.url,
        tweetId,
      };
    }
  } catch (error) {
    syndicationError = error instanceof Error ? error : new Error("X video lookup failed.");
  }

  const archivedVideo = await resolveArchivedTweetVideo(tweetId);

  if (archivedVideo) {
    return archivedVideo;
  }

  if (syndicationError) {
    throw syndicationError;
  }

  return null;
}
