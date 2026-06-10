import { NextResponse } from "next/server";
import { getTwitchVideosByLogin } from "@/lib/twitch-api";

const twitchClientId = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const maxVideos = 8;

type TwitchVideoNode = {
  creator?: {
    displayName?: string;
    login?: string;
  };
  game?: {
    name?: string;
  } | null;
  id?: string;
  lengthSeconds?: number;
  previewThumbnailURL?: string;
  publishedAt?: string;
  title?: string;
  viewCount?: number;
};

function normalizeTwitchChannel(channel: string) {
  return channel.trim().replace(/[^\w]/g, "").slice(0, 32);
}

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 5;
  }

  return Math.max(1, Math.min(parsed, maxVideos));
}

function normalizeThumbnail(url: string | undefined) {
  return (url ?? "")
    .replace("{width}", "320")
    .replace("{height}", "180")
    .replace("%{width}", "320")
    .replace("%{height}", "180");
}

function parseTwitchDuration(duration: string | undefined) {
  if (!duration) {
    return 0;
  }

  const matches = duration.matchAll(/(\d+)(h|m|s)/g);
  let seconds = 0;

  for (const match of matches) {
    const value = Number(match[1]);
    const unit = match[2];

    if (unit === "h") {
      seconds += value * 60 * 60;
    } else if (unit === "m") {
      seconds += value * 60;
    } else {
      seconds += value;
    }
  }

  return seconds;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = normalizeTwitchChannel(searchParams.get("channel") ?? "fazebanks") || "fazebanks";
  const limit = normalizeLimit(searchParams.get("limit"));

  try {
    const officialVideos = await getTwitchVideosByLogin(channel, limit);

    if (officialVideos) {
      const videos = officialVideos
        .map((video) => ({
          channel,
          creator: video.user_name ?? channel,
          durationSeconds: parseTwitchDuration(video.duration),
          game: "Just Chatting",
          id: video.id ?? "",
          publishedAt: video.published_at ?? video.created_at ?? null,
          thumbnailUrl: normalizeThumbnail(video.thumbnail_url),
          title: video.title ?? "Recent stream",
          url: video.url ?? `https://www.twitch.tv/videos/${video.id}`,
          viewCount: Number(video.view_count ?? 0),
        }))
        .filter((video) => video.id)
        .slice(0, limit);

      return NextResponse.json(
        { channel, fetchedAt: new Date().toISOString(), source: "twitch-helix", videos },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const response = await fetch("https://gql.twitch.tv/gql", {
      method: "POST",
      headers: {
        "Client-ID": twitchClientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operationName: "RecentVideos",
        variables: { limit, login: channel },
        query:
          "query RecentVideos($login: String!, $limit: Int!) { user(login: $login) { videos(first: $limit, type: ARCHIVE, sort: TIME) { edges { node { id title publishedAt lengthSeconds viewCount previewThumbnailURL creator { displayName login } game { name } } } } } }",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { channel, error: "Recent Twitch streams unavailable.", videos: [] },
        { status: response.status },
      );
    }

    const data = await response.json();
    const edges = data?.data?.user?.videos?.edges ?? [];
    const videos = edges
      .map((edge: { node?: TwitchVideoNode }) => edge.node)
      .filter(Boolean)
      .map((video: TwitchVideoNode) => ({
        channel,
        creator: video.creator?.displayName ?? channel,
        durationSeconds: Number(video.lengthSeconds ?? 0),
        game: video.game?.name ?? "Just Chatting",
        id: video.id ?? "",
        publishedAt: video.publishedAt ?? null,
        thumbnailUrl: normalizeThumbnail(video.previewThumbnailURL),
        title: video.title ?? "Recent stream",
        url: `https://www.twitch.tv/videos/${video.id}`,
        viewCount: Number(video.viewCount ?? 0),
      }))
      .filter((video: { id: string }) => video.id)
      .slice(0, limit);

    return NextResponse.json(
      { channel, fetchedAt: new Date().toISOString(), videos },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { channel, error: "Recent Twitch streams unavailable.", videos: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
