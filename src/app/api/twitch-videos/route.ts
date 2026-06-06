import { NextResponse } from "next/server";

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
  return (url ?? "").replace("{width}", "320").replace("{height}", "180");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = normalizeTwitchChannel(searchParams.get("channel") ?? "fazebanks") || "fazebanks";
  const limit = normalizeLimit(searchParams.get("limit"));

  try {
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
