import { Redis } from "@upstash/redis";
import type {
  CommunityChatEvent,
  CommunityChatterEntry,
  CommunityPlatform,
  CommunityTopChatResponse,
} from "@/lib/community-top-chat-types";

const rankKey = "marketbubble:community:top-chat:rank";
const chatterHashKey = "marketbubble:community:top-chat:chatters";
const seenEventKey = "marketbubble:community:top-chat:seen-events";
const totalMessagesKey = "marketbubble:community:top-chat:total-messages";
const maxEventsPerWrite = 120;
const maxStoredChatters = 160;
const seenEventTtlSeconds = 72 * 60 * 60;

let redisClient: Redis | null | undefined;

function getRedis() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({ token, url });
  return redisClient;
}

function isCommunityPlatform(value: unknown): value is CommunityPlatform {
  return value === "Twitch" || value === "Kick" || value === "X";
}

function normalizeEvent(event: unknown): CommunityChatEvent | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const value = event as Partial<CommunityChatEvent>;
  const author = typeof value.author === "string" ? value.author.trim().slice(0, 48) : "";
  const color =
    typeof value.color === "string" && /^#[0-9a-f]{3,8}$/i.test(value.color)
      ? value.color
      : "#e4e4e4";
  const receivedAt = Number(value.receivedAt);
  const sourceId =
    typeof value.sourceId === "string" ? value.sourceId.trim().slice(0, 180) : "";
  const text = typeof value.text === "string" ? value.text.replace(/\s+/g, " ").trim() : "";

  if (
    !author ||
    !isCommunityPlatform(value.platform) ||
    !Number.isFinite(receivedAt) ||
    receivedAt <= 0 ||
    !sourceId ||
    !text
  ) {
    return null;
  }

  return {
    author,
    color,
    platform: value.platform,
    receivedAt,
    sourceId,
    text: text.slice(0, 260),
  };
}

function getChatterKey(event: CommunityChatEvent) {
  return `${event.platform}:${event.author.toLowerCase()}`;
}

function isCommunityChatEvent(event: CommunityChatEvent | null): event is CommunityChatEvent {
  return Boolean(event);
}

function parseChatterEntry(value: unknown): CommunityChatterEntry | null {
  try {
    const parsedEntry =
      typeof value === "string" ? (JSON.parse(value) as unknown) : value;

    if (
      !parsedEntry ||
      typeof parsedEntry !== "object"
    ) {
      return null;
    }

    const entry = parsedEntry as Partial<CommunityChatterEntry>;

    if (
      typeof entry.author !== "string" ||
      typeof entry.color !== "string" ||
      typeof entry.count !== "number" ||
      typeof entry.lastMessage !== "string" ||
      typeof entry.lastSeen !== "number" ||
      !isCommunityPlatform(entry.platform)
    ) {
      return null;
    }

    return {
      author: entry.author,
      color: entry.color,
      count: entry.count,
      lastMessage: entry.lastMessage,
      lastSeen: entry.lastSeen,
      platform: entry.platform,
    };
  } catch {
    return null;
  }
}

function emptyResponse(reason?: CommunityTopChatResponse["reason"]): CommunityTopChatResponse {
  return {
    chatters: {},
    reason,
    stored: false,
    totalMessages: 0,
  };
}

export async function readCommunityTopChat(): Promise<CommunityTopChatResponse> {
  const redis = getRedis();

  if (!redis) {
    return emptyResponse("missing-env");
  }

  try {
    const chatterKeys = await redis.zrange<string[]>(rankKey, 0, maxStoredChatters - 1, {
      rev: true,
    });
    const pipeline = redis.pipeline();

    for (const chatterKey of chatterKeys) {
      pipeline.hget(chatterHashKey, chatterKey);
    }

    pipeline.get(totalMessagesKey);

    const results = (await pipeline.exec()) as unknown[];
    const totalMessages = Number(results.at(-1) ?? 0);
    const chatters = Object.fromEntries(
      chatterKeys
        .map((chatterKey, index) => [chatterKey, parseChatterEntry(results[index])] as const)
        .filter((entry): entry is readonly [string, CommunityChatterEntry] =>
          Boolean(entry[1]),
        ),
    );

    return {
      chatters,
      stored: true,
      totalMessages: Number.isFinite(totalMessages) ? totalMessages : 0,
      updatedAt: Date.now(),
    };
  } catch {
    return emptyResponse("storage-error");
  }
}

export async function writeCommunityChatEvents(
  events: unknown[],
): Promise<CommunityTopChatResponse> {
  const redis = getRedis();

  if (!redis) {
    return emptyResponse("missing-env");
  }

  const normalizedEvents = events
    .map(normalizeEvent)
    .filter(isCommunityChatEvent)
    .slice(0, maxEventsPerWrite);

  if (normalizedEvents.length === 0) {
    return readCommunityTopChat();
  }

  try {
    const dedupePipeline = redis.pipeline();

    for (const event of normalizedEvents) {
      dedupePipeline.sadd(seenEventKey, event.sourceId);
    }

    const dedupeResults = (await dedupePipeline.exec()) as unknown[];
    const newEvents = normalizedEvents.filter((_, index) => Number(dedupeResults[index]) === 1);

    if (newEvents.length === 0) {
      return readCommunityTopChat();
    }

    const groupedEvents = new Map<
      string,
      { count: number; latest: CommunityChatEvent; latestSeen: number }
    >();

    for (const event of newEvents) {
      const chatterKey = getChatterKey(event);
      const previous = groupedEvents.get(chatterKey);

      if (!previous) {
        groupedEvents.set(chatterKey, {
          count: 1,
          latest: event,
          latestSeen: event.receivedAt,
        });
        continue;
      }

      previous.count += 1;

      if (event.receivedAt >= previous.latestSeen) {
        previous.latest = event;
        previous.latestSeen = event.receivedAt;
      }
    }

    for (const [chatterKey, group] of groupedEvents) {
      const count = await redis.zincrby(rankKey, group.count, chatterKey);
      const entry: CommunityChatterEntry = {
        author: group.latest.author,
        color: group.latest.color,
        count: Number(count),
        lastMessage: group.latest.text,
        lastSeen: group.latestSeen,
        platform: group.latest.platform,
      };

      await redis.hset(chatterHashKey, {
        [chatterKey]: JSON.stringify(entry),
      });
    }

    await redis.incrby(totalMessagesKey, newEvents.length);
    await redis.expire(seenEventKey, seenEventTtlSeconds);
    await redis.zremrangebyrank(rankKey, 0, -(maxStoredChatters + 1));

    return readCommunityTopChat();
  } catch {
    return emptyResponse("storage-error");
  }
}
