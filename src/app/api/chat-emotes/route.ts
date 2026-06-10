import { NextResponse } from "next/server";
import { getTwitchUsersByLogin } from "@/lib/twitch-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChatEmoteProvider = "7tv" | "bttv" | "ffz";

type ChatEmoteDefinition = {
  id: string;
  name: string;
  provider: ChatEmoteProvider;
  url: string;
};

type SevenTvEmote = {
  id?: string;
  name?: string;
};

type SevenTvSetPayload = {
  emotes?: SevenTvEmote[];
};

type SevenTvUserPayload = {
  emote_set?: SevenTvSetPayload;
};

type BttvEmote = {
  code?: string;
  id?: string;
};

type BttvUserPayload = {
  channelEmotes?: BttvEmote[];
  sharedEmotes?: BttvEmote[];
};

type FfzEmote = {
  id?: number | string;
  name?: string;
  urls?: Record<string, string>;
};

type FfzPayload = {
  sets?: Record<string, { emoticons?: FfzEmote[] }>;
};

type CachedPayload = {
  cacheKey: string;
  data: {
    emotes: Record<string, ChatEmoteDefinition>;
    fetchedAt: number;
  };
  expiresAt: number;
};

const cacheTtlMs = 15 * 60 * 1000;
let cachedPayload: CachedPayload | null = null;

function normalizeChannel(value: string) {
  return value.replace(/^#/, "").replace(/[^\w]/g, "").toLowerCase();
}

function normalizeChannels(searchParams: URLSearchParams) {
  return Array.from(
    new Set(
      [
        ...searchParams.getAll("twitchChannel"),
        ...searchParams.getAll("channel"),
      ]
        .flatMap((value) => value.split(","))
        .map((value) => normalizeChannel(value.trim()))
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function addEmote(
  emotes: Map<string, ChatEmoteDefinition>,
  emote: ChatEmoteDefinition | null,
) {
  if (!emote || !emote.name || !emote.id || !emote.url) {
    return;
  }

  if (!emotes.has(emote.name)) {
    emotes.set(emote.name, emote);
  }
}

function addSevenTvEmotes(
  emotes: Map<string, ChatEmoteDefinition>,
  payload: SevenTvSetPayload | null | undefined,
) {
  for (const emote of payload?.emotes ?? []) {
    if (!emote.id || !emote.name) {
      continue;
    }

    addEmote(emotes, {
      id: emote.id,
      name: emote.name,
      provider: "7tv",
      url: `https://cdn.7tv.app/emote/${encodeURIComponent(emote.id)}/2x.webp`,
    });
  }
}

function addBttvEmotes(
  emotes: Map<string, ChatEmoteDefinition>,
  payload: BttvEmote[] | null | undefined,
) {
  for (const emote of payload ?? []) {
    if (!emote.id || !emote.code) {
      continue;
    }

    addEmote(emotes, {
      id: emote.id,
      name: emote.code,
      provider: "bttv",
      url: `https://cdn.betterttv.net/emote/${encodeURIComponent(emote.id)}/2x`,
    });
  }
}

function addFfzEmotes(
  emotes: Map<string, ChatEmoteDefinition>,
  payload: FfzPayload | null | undefined,
) {
  for (const set of Object.values(payload?.sets ?? {})) {
    for (const emote of set.emoticons ?? []) {
      const id = String(emote.id ?? "");
      const url = emote.urls?.["2"] ?? emote.urls?.["1"] ?? emote.urls?.["4"] ?? "";

      if (!id || !emote.name || !url) {
        continue;
      }

      addEmote(emotes, {
        id,
        name: emote.name,
        provider: "ffz",
        url: url.startsWith("//") ? `https:${url}` : url,
      });
    }
  }
}

async function getTwitchUserIdsByLogin(channels: string[]) {
  const users = await getTwitchUsersByLogin(channels);

  if (!users) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(users)
      .filter(([, user]) => user.id)
      .map(([login, user]) => [login, String(user.id)]),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channels = normalizeChannels(searchParams);
  const cacheKey = channels.toSorted().join(",");

  if (
    cachedPayload &&
    cachedPayload.expiresAt > Date.now() &&
    cachedPayload.cacheKey === cacheKey
  ) {
    return NextResponse.json(cachedPayload.data);
  }

  const emotes = new Map<string, ChatEmoteDefinition>();
  const [sevenTvGlobal, bttvGlobal, ffzGlobal, twitchUserIds] = await Promise.all([
    fetchJson<SevenTvSetPayload>("https://7tv.io/v3/emote-sets/global"),
    fetchJson<BttvEmote[]>("https://api.betterttv.net/3/cached/emotes/global"),
    fetchJson<FfzPayload>("https://api.frankerfacez.com/v1/set/global"),
    getTwitchUserIdsByLogin(channels),
  ]);

  addSevenTvEmotes(emotes, sevenTvGlobal);
  addBttvEmotes(emotes, bttvGlobal);
  addFfzEmotes(emotes, ffzGlobal);

  await Promise.all(
    channels.map(async (channel) => {
      const userId = twitchUserIds[channel];
      const [ffzRoom, bttvRoom, sevenTvUser] = await Promise.all([
        fetchJson<FfzPayload>(
          `https://api.frankerfacez.com/v1/room/${encodeURIComponent(channel)}`,
        ),
        userId
          ? fetchJson<BttvUserPayload>(
              `https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(
                userId,
              )}`,
            )
          : Promise.resolve(null),
        userId
          ? fetchJson<SevenTvUserPayload>(
              `https://7tv.io/v3/users/twitch/${encodeURIComponent(userId)}`,
            )
          : Promise.resolve(null),
      ]);

      addFfzEmotes(emotes, ffzRoom);
      addBttvEmotes(emotes, bttvRoom?.channelEmotes);
      addBttvEmotes(emotes, bttvRoom?.sharedEmotes);
      addSevenTvEmotes(emotes, sevenTvUser?.emote_set);
    }),
  );

  const data = {
    emotes: Object.fromEntries(emotes),
    fetchedAt: Date.now(),
  };

  cachedPayload = {
    cacheKey,
    data,
    expiresAt: Date.now() + cacheTtlMs,
  };

  return NextResponse.json(data);
}
