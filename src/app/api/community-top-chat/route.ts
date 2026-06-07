import { NextResponse } from "next/server";
import {
  readCommunityTopChat,
  writeCommunityChatEvents,
} from "@/lib/community-top-chat-store";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function GET() {
  return NextResponse.json(await readCommunityTopChat(), {
    headers: noStoreHeaders,
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { events?: unknown[] };
    const events = Array.isArray(payload.events) ? payload.events : [];

    return NextResponse.json(await writeCommunityChatEvents(events), {
      headers: noStoreHeaders,
    });
  } catch {
    return NextResponse.json(await readCommunityTopChat(), {
      headers: noStoreHeaders,
      status: 400,
    });
  }
}
