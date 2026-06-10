import { NextResponse } from "next/server";
import {
  readCommunityLiveEvents,
  writeCommunityChatEvents,
} from "@/lib/community-top-chat-store";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 120;
  }

  return Math.max(1, Math.min(parsed, 420));
}

function hasValidIngestAuth(request: Request) {
  const secret = process.env.STREAM_EVENT_INGEST_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  return token === secret;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  return NextResponse.json(
    await readCommunityLiveEvents(normalizeLimit(searchParams.get("limit"))),
    { headers: noStoreHeaders },
  );
}

export async function POST(request: Request) {
  if (!hasValidIngestAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized live event ingest." },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  try {
    const payload = (await request.json()) as { events?: unknown[] };
    const events = Array.isArray(payload.events) ? payload.events : [];

    return NextResponse.json(await writeCommunityChatEvents(events), {
      headers: noStoreHeaders,
    });
  } catch {
    return NextResponse.json(await readCommunityLiveEvents(), {
      headers: noStoreHeaders,
      status: 400,
    });
  }
}
