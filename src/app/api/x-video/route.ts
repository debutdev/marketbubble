import { getTweetId, resolveTweetVideo } from "@/lib/x-video";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tweetId = getTweetId(searchParams.get("id") ?? searchParams.get("url"));

  if (!tweetId) {
    return NextResponse.json({ error: "A valid tweet id is required." }, { status: 400 });
  }

  try {
    const video = await resolveTweetVideo(tweetId);

    if (!video) {
      return NextResponse.json({ error: "No playable video found for this post." }, { status: 404 });
    }

    return NextResponse.json(
      {
        aspectRatio: video.aspectRatio,
        durationMs: video.durationMs,
        posterUrl: video.posterUrl,
        tweetId: video.tweetId,
        videoUrl: `/api/x-video/stream?id=${encodeURIComponent(video.tweetId)}`,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Unable to resolve clip video." }, { status: 502 });
  }
}
