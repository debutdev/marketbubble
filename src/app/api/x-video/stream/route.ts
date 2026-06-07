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

    const range = request.headers.get("range");
    const upstream = await fetch(video.sourceVideoUrl, {
      cache: "no-store",
      headers: {
        ...(range ? { Range: range } : {}),
        Accept: "video/mp4,*/*",
        Referer: "https://platform.twitter.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: `Clip stream returned ${upstream.status}.` }, { status: 502 });
    }

    const headers = new Headers();

    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
    headers.set("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");

    for (const header of ["content-length", "content-range"]) {
      const value = upstream.headers.get(header);

      if (value) {
        headers.set(header, value);
      }
    }

    return new Response(upstream.body, {
      headers,
      status: upstream.status,
      statusText: upstream.statusText,
    });
  } catch {
    return NextResponse.json({ error: "Unable to stream clip video." }, { status: 502 });
  }
}
