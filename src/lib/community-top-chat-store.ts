import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type {
  CommunityChatEvent,
  CommunityChatterEntry,
  CommunityLiveEventsResponse,
  CommunityPlatform,
  CommunityTopChatResponse,
} from "@/lib/community-top-chat-types";

const rankKey = "marketbubble:community:top-chat:rank";
const chatterHashKey = "marketbubble:community:top-chat:chatters";
const recentEventsKey = "marketbubble:community:live-events";
const seenEventKey = "marketbubble:community:top-chat:seen-events";
const totalMessagesKey = "marketbubble:community:top-chat:total-messages";
const maxEventsPerWrite = 120;
const maxRecentEvents = 420;
const maxStoredChatters = 160;
const seenEventTtlSeconds = 72 * 60 * 60;
const fileStorePath = path.join(process.cwd(), ".data", "community-chat-store.json");
const maxFileSeenEvents = 10_000;

let redisClient: Redis | null | undefined;
let memoryChatters: Record<string, CommunityChatterEntry> = {};
let memoryRecentEvents: CommunityChatEvent[] = [];
const memorySeenEventIds = new Set<string>();
let memoryTotalMessages = 0;

type FileCommunityChatStore = {
  chatters: Record<string, CommunityChatterEntry>;
  recentEvents: CommunityChatEvent[];
  seenEventIds: string[];
  totalMessages: number;
  updatedAt: number;
};

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function getRedis() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = cleanEnvValue(process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL);
  const token = cleanEnvValue(
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
  );

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
  const channel =
    typeof value.channel === "string"
      ? value.channel.trim().replace(/^@/, "").replace(/[^\w-]/g, "").slice(0, 48)
      : undefined;
  const color =
    typeof value.color === "string" && /^#[0-9a-f]{3,8}$/i.test(value.color)
      ? value.color
      : "#e4e4e4";
  const bits = Number(value.bits);
  const eventLabel =
    typeof value.eventLabel === "string"
      ? value.eventLabel.replace(/\s+/g, " ").trim().slice(0, 80)
      : undefined;
  const eventType =
    value.eventType === "bits" ||
    value.eventType === "first-message" ||
    value.eventType === "raid" ||
    value.eventType === "sub" ||
    value.eventType === "subgift" ||
    value.eventType === "system"
      ? value.eventType
      : undefined;
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
    ...(Number.isFinite(bits) && bits > 0 ? { bits } : {}),
    ...(channel ? { channel } : {}),
    color,
    ...(eventLabel ? { eventLabel } : {}),
    ...(eventType ? { eventType } : {}),
    ...(value.firstMessage === true ? { firstMessage: true } : {}),
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

function parseStoredEvent(value: unknown): CommunityChatEvent | null {
  try {
    return normalizeEvent(typeof value === "string" ? JSON.parse(value) : value);
  } catch {
    return null;
  }
}

function trimMemorySeenEvents() {
  if (memorySeenEventIds.size <= 10_000) {
    return;
  }

  for (const sourceId of memorySeenEventIds) {
    memorySeenEventIds.delete(sourceId);

    if (memorySeenEventIds.size <= 8_000) {
      break;
    }
  }
}

function readMemoryTopChat(
  reason: CommunityTopChatResponse["reason"] = "memory-fallback",
): CommunityTopChatResponse {
  const chatters = Object.fromEntries(
    Object.entries(memoryChatters)
      .toSorted(([, first], [, second]) => second.count - first.count)
      .slice(0, maxStoredChatters),
  );

  return {
    chatters,
    reason,
    stored: true,
    totalMessages: memoryTotalMessages,
    updatedAt: Date.now(),
  };
}

function readMemoryLiveEvents(
  limit = 120,
  reason: CommunityLiveEventsResponse["reason"] = "memory-fallback",
): CommunityLiveEventsResponse {
  const parsedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 120;
  const normalizedLimit = Math.max(1, Math.min(parsedLimit, maxRecentEvents));

  return {
    events: memoryRecentEvents.slice(-normalizedLimit),
    reason,
    stored: true,
    updatedAt: Date.now(),
  };
}

function createEmptyFileStore(): FileCommunityChatStore {
  return {
    chatters: {},
    recentEvents: [],
    seenEventIds: [],
    totalMessages: 0,
    updatedAt: Date.now(),
  };
}

async function readFileStore(): Promise<FileCommunityChatStore | null> {
  try {
    const rawStore = JSON.parse(await readFile(fileStorePath, "utf8")) as Partial<FileCommunityChatStore>;
    const chatters = Object.fromEntries(
      Object.entries(rawStore.chatters ?? {})
        .map(([key, value]) => [key, parseChatterEntry(value)] as const)
        .filter((entry): entry is readonly [string, CommunityChatterEntry] =>
          Boolean(entry[1]),
        )
        .toSorted(([, first], [, second]) => second.count - first.count)
        .slice(0, maxStoredChatters),
    );
    const recentEvents = (rawStore.recentEvents ?? [])
      .map(parseStoredEvent)
      .filter(isCommunityChatEvent)
      .slice(-maxRecentEvents);
    const seenEventIds = Array.from(
      new Set(
        [
          ...(Array.isArray(rawStore.seenEventIds) ? rawStore.seenEventIds : []),
          ...recentEvents.map((event) => event.sourceId),
        ].filter(
          (sourceId): sourceId is string =>
            typeof sourceId === "string" && sourceId.length > 0,
        ),
      ),
    ).slice(-maxFileSeenEvents);
    const totalMessages = Number(rawStore.totalMessages ?? 0);

    return {
      chatters,
      recentEvents,
      seenEventIds,
      totalMessages: Number.isFinite(totalMessages) ? totalMessages : recentEvents.length,
      updatedAt: Number(rawStore.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

async function writeFileStore(store: FileCommunityChatStore) {
  await mkdir(path.dirname(fileStorePath), { recursive: true });

  const tmpPath = `${fileStorePath}.${process.pid}.${Date.now()}.tmp`;

  await writeFile(tmpPath, JSON.stringify(store), "utf8");
  await rename(tmpPath, fileStorePath);
}

async function readFileTopChat(
  reason: CommunityTopChatResponse["reason"] = "file-fallback",
): Promise<CommunityTopChatResponse> {
  const store = await readFileStore();

  if (!store) {
    return readMemoryTopChat(reason);
  }

  const chatters = Object.fromEntries(
    Object.entries({ ...store.chatters, ...memoryChatters })
      .toSorted(([, first], [, second]) => second.count - first.count)
      .slice(0, maxStoredChatters),
  );

  return {
    chatters,
    reason,
    stored: true,
    totalMessages: store.totalMessages + memoryTotalMessages,
    updatedAt: Date.now(),
  };
}

async function readFileLiveEvents(
  limit = 120,
  reason: CommunityLiveEventsResponse["reason"] = "file-fallback",
): Promise<CommunityLiveEventsResponse> {
  const store = await readFileStore();

  if (!store) {
    return readMemoryLiveEvents(limit, reason);
  }

  const parsedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 120;
  const normalizedLimit = Math.max(1, Math.min(parsedLimit, maxRecentEvents));
  const events = dedupeEvents([...store.recentEvents, ...memoryRecentEvents])
    .toSorted((first, second) => first.receivedAt - second.receivedAt)
    .slice(-normalizedLimit);

  return {
    events,
    reason,
    stored: true,
    updatedAt: Date.now(),
  };
}

function dedupeEvents(events: CommunityChatEvent[]) {
  const seenSourceIds = new Set<string>();

  return events.filter((event) => {
    if (seenSourceIds.has(event.sourceId)) {
      return false;
    }

    seenSourceIds.add(event.sourceId);
    return true;
  });
}

function writeMemoryChatEvents(events: CommunityChatEvent[]) {
  const newEvents = events.filter((event) => {
    if (memorySeenEventIds.has(event.sourceId)) {
      return false;
    }

    memorySeenEventIds.add(event.sourceId);
    return true;
  });

  if (newEvents.length === 0) {
    return readMemoryTopChat();
  }

  memoryRecentEvents = [...memoryRecentEvents, ...newEvents].slice(-maxRecentEvents);
  memoryTotalMessages += newEvents.length;

  for (const event of newEvents) {
    const chatterKey = getChatterKey(event);
    const previous = memoryChatters[chatterKey];

    memoryChatters[chatterKey] = {
      author: event.author,
      color: event.color,
      count: (previous?.count ?? 0) + 1,
      lastMessage: event.text,
      lastSeen: Math.max(previous?.lastSeen ?? 0, event.receivedAt),
      platform: event.platform,
    };
  }

  memoryChatters = Object.fromEntries(
    Object.entries(memoryChatters)
      .toSorted(([, first], [, second]) => second.count - first.count)
      .slice(0, maxStoredChatters),
  );
  trimMemorySeenEvents();

  return readMemoryTopChat();
}

async function writeFileChatEvents(
  events: CommunityChatEvent[],
  reason: CommunityTopChatResponse["reason"] = "file-fallback",
): Promise<CommunityTopChatResponse> {
  const store = (await readFileStore()) ?? createEmptyFileStore();
  const seenEventIds = new Set(store.seenEventIds);
  const newEvents = events.filter((event) => {
    if (seenEventIds.has(event.sourceId)) {
      return false;
    }

    seenEventIds.add(event.sourceId);
    return true;
  });

  if (newEvents.length === 0) {
    return readFileTopChat(reason);
  }

  const chatters = { ...store.chatters };

  for (const event of newEvents) {
    const chatterKey = getChatterKey(event);
    const previous = chatters[chatterKey];

    chatters[chatterKey] = {
      author: event.author,
      color: event.color,
      count: (previous?.count ?? 0) + 1,
      lastMessage: event.text,
      lastSeen: Math.max(previous?.lastSeen ?? 0, event.receivedAt),
      platform: event.platform,
    };
  }

  const nextStore: FileCommunityChatStore = {
    chatters: Object.fromEntries(
      Object.entries(chatters)
        .toSorted(([, first], [, second]) => second.count - first.count)
        .slice(0, maxStoredChatters),
    ),
    recentEvents: dedupeEvents([...store.recentEvents, ...newEvents])
      .toSorted((first, second) => first.receivedAt - second.receivedAt)
      .slice(-maxRecentEvents),
    seenEventIds: Array.from(seenEventIds).slice(-maxFileSeenEvents),
    totalMessages: store.totalMessages + newEvents.length,
    updatedAt: Date.now(),
  };

  try {
    await writeFileStore(nextStore);
    return readFileTopChat(reason);
  } catch {
    return writeMemoryChatEvents(events);
  }
}

export async function readCommunityTopChat(): Promise<CommunityTopChatResponse> {
  const redis = getRedis();

  if (!redis) {
    return readFileTopChat("missing-env");
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
    const fileStore = await readFileStore();
    const chatters = Object.fromEntries(
      chatterKeys
        .map((chatterKey, index) => [chatterKey, parseChatterEntry(results[index])] as const)
        .filter((entry): entry is readonly [string, CommunityChatterEntry] =>
          Boolean(entry[1]),
        ),
    );
    const combinedChatters = Object.fromEntries(
      Object.entries({ ...(fileStore?.chatters ?? {}), ...chatters, ...memoryChatters })
        .toSorted(([, first], [, second]) => second.count - first.count)
        .slice(0, maxStoredChatters),
    );

    return {
      chatters: combinedChatters,
      stored: true,
      totalMessages:
        (fileStore?.totalMessages ?? 0) +
        (Number.isFinite(totalMessages) ? totalMessages : 0) +
        memoryTotalMessages,
      updatedAt: Date.now(),
    };
  } catch {
    return readFileTopChat("storage-error");
  }
}

export async function readCommunityLiveEvents(
  limit = 120,
): Promise<CommunityLiveEventsResponse> {
  const redis = getRedis();

  if (!redis) {
    return readFileLiveEvents(limit, "missing-env");
  }

  const parsedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 120;
  const normalizedLimit = Math.max(1, Math.min(parsedLimit, maxRecentEvents));

  try {
    const fileStore = await readFileStore();
    const storedEvents = await redis.lrange<string>(
      recentEventsKey,
      -normalizedLimit,
      -1,
    );
    const events = storedEvents
      .map(parseStoredEvent)
      .filter(isCommunityChatEvent);
    const combinedEvents = dedupeEvents([
      ...(fileStore?.recentEvents ?? []),
      ...events,
      ...memoryRecentEvents,
    ])
      .toSorted((first, second) => first.receivedAt - second.receivedAt)
      .slice(-normalizedLimit);

    return {
      events: combinedEvents,
      stored: true,
      updatedAt: Date.now(),
    };
  } catch {
    return readFileLiveEvents(limit, "storage-error");
  }
}

export async function writeCommunityChatEvents(
  events: unknown[],
): Promise<CommunityTopChatResponse> {
  const redis = getRedis();

  const normalizedEvents = events
    .map(normalizeEvent)
    .filter(isCommunityChatEvent)
    .slice(0, maxEventsPerWrite);

  if (normalizedEvents.length === 0) {
    return readCommunityTopChat();
  }

  if (!redis) {
    return writeFileChatEvents(normalizedEvents, "missing-env");
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

    const recentEventsPipeline = redis.pipeline();

    recentEventsPipeline.rpush(
      recentEventsKey,
      ...newEvents.map((event) => JSON.stringify(event)),
    );
    recentEventsPipeline.ltrim(recentEventsKey, -maxRecentEvents, -1);
    await recentEventsPipeline.exec();

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

    const rankPipeline = redis.pipeline();
    const groupedEntries = Array.from(groupedEvents.entries());

    for (const [chatterKey, group] of groupedEntries) {
      rankPipeline.zincrby(rankKey, group.count, chatterKey);
    }

    const rankResults = (await rankPipeline.exec()) as unknown[];
    const chatterPipeline = redis.pipeline();

    groupedEntries.forEach(([chatterKey, group], index) => {
      const count = Number(rankResults[index] ?? group.count);
      const entry: CommunityChatterEntry = {
        author: group.latest.author,
        color: group.latest.color,
        count: Number(count),
        lastMessage: group.latest.text,
        lastSeen: group.latestSeen,
        platform: group.latest.platform,
      };

      chatterPipeline.hset(chatterHashKey, {
        [chatterKey]: JSON.stringify(entry),
      });
    });

    chatterPipeline.incrby(totalMessagesKey, newEvents.length);
    chatterPipeline.expire(seenEventKey, seenEventTtlSeconds);
    chatterPipeline.zremrangebyrank(rankKey, 0, -(maxStoredChatters + 1));
    await chatterPipeline.exec();

    return readCommunityTopChat();
  } catch {
    return writeFileChatEvents(normalizedEvents, "storage-error");
  }
}
