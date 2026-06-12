import { NextResponse } from "next/server";
import { readCommunityLiveEvents } from "@/lib/community-top-chat-store";
import type { CommunityChatEvent } from "@/lib/community-top-chat-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

const handleAliases: Record<string, string[]> = {
  ansem: ["ansem", "blknoiz06"],
  banks: ["banks", "fazebanks"],
  blknoiz06: ["blknoiz06", "ansem"],
  fazebanks: ["fazebanks", "banks"],
};

function normalizeHandle(value: string) {
  return value.replace(/^@/, "").replace(/[^\w-]/g, "").slice(0, 48);
}

function getRequestedHandles(searchParams: URLSearchParams) {
  const values = [
    ...searchParams.getAll("handle"),
    ...searchParams.getAll("xHandle"),
  ].flatMap((value) => value.split(","));
  const handles = values
    .map((value) => normalizeHandle(value.trim()))
    .filter(Boolean);

  return Array.from(new Set(handles.length > 0 ? handles : ["MarketBubble"])).slice(
    0,
    8,
  );
}

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 32;
  }

  return Math.max(1, Math.min(parsed, 96));
}

function getAcceptedHandles(handles: string[]) {
  const acceptedHandles = new Set<string>();

  for (const handle of handles) {
    const normalizedHandle = normalizeHandle(handle).toLowerCase();

    if (!normalizedHandle) {
      continue;
    }

    acceptedHandles.add(normalizedHandle);

    for (const alias of handleAliases[normalizedHandle] ?? []) {
      acceptedHandles.add(alias.toLowerCase());
    }
  }

  return acceptedHandles;
}

function eventMatchesHandles(event: CommunityChatEvent, acceptedHandles: Set<string>) {
  if (event.platform !== "X") {
    return false;
  }

  if (!event.sourceId.startsWith("x-broadcast:")) {
    return false;
  }

  const channel = event.channel?.toLowerCase();

  return channel ? acceptedHandles.has(channel) : acceptedHandles.size > 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handles = getRequestedHandles(searchParams);
  const acceptedHandles = getAcceptedHandles(handles);
  const limit = normalizeLimit(searchParams.get("limit"));
  const lookbackHours = Number.parseFloat(searchParams.get("lookbackHours") ?? "24");
  const lookbackMs = Number.isFinite(lookbackHours)
    ? Math.max(1, Math.min(lookbackHours, 24 * 30)) * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;
  const oldestAllowed = Date.now() - lookbackMs;
  const payload = await readCommunityLiveEvents(420);
  const events = payload.events
    .filter((event) => eventMatchesHandles(event, acceptedHandles))
    .filter((event) => event.receivedAt >= oldestAllowed)
    .slice(-limit);

  return NextResponse.json(
    {
      events,
      handles,
      reason: events.length > 0 ? payload.reason : "x-broadcast-chat-empty",
      stored: payload.stored,
      updatedAt: Date.now(),
      warnings:
        events.length > 0
          ? []
          : [
              "No X broadcast chat messages have been ingested for the requested handles yet.",
            ],
    },
    { headers: noStoreHeaders },
  );
}
