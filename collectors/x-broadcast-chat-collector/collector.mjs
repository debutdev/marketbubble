import { existsSync, readFileSync } from "node:fs";
import WebSocket from "ws";

const X_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
// Public bearer token shipped to logged-out X web clients. This is not a user secret.
const X_WEB_BEARER =
  "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const defaultIngestUrl = "http://127.0.0.1:3000/api/community-live-events";
const defaultHandlePollMs = 60_000;
const guestTokenTtlMs = 2.5 * 60 * 60 * 1000;
const localEnv = readLocalEnv();

let guestToken = "";
let guestTokenCreatedAt = 0;

function readLocalEnv() {
  if (!existsSync(".env.local")) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map((match) => [match[1], cleanEnvValue(match[2])]),
  );
}

function cleanEnvValue(value) {
  const trimmed = value?.trim() ?? "";

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function envValue(name, fallback = "") {
  return cleanEnvValue(process.env[name] ?? localEnv[name] ?? fallback);
}

function normalizeHandle(value) {
  return value.replace(/^@/, "").replace(/[^\w-]/g, "").slice(0, 48);
}

function splitEnvList(value) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function broadcastIdFromUrl(value) {
  const match = value.match(/\/i\/(?:broadcasts|spaces)\/([A-Za-z0-9]+)/i);

  return match?.[1] ?? (/^[A-Za-z0-9]+$/.test(value) ? value : null);
}

function getBroadcastUrl(value) {
  const id = broadcastIdFromUrl(value);

  return id ? `https://x.com/i/broadcasts/${id}` : value;
}

function parseBroadcastSources(value) {
  return splitEnvList(value).flatMap((entry) => {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex === -1) {
      const id = broadcastIdFromUrl(entry);

      return id
        ? [{ fallbackChannel: "", id, url: getBroadcastUrl(entry) }]
        : [];
    }

    const fallbackChannel = normalizeHandle(entry.slice(0, separatorIndex));
    const url = entry.slice(separatorIndex + 1).trim();
    const id = broadcastIdFromUrl(url);

    return id ? [{ fallbackChannel, id, url: getBroadcastUrl(url) }] : [];
  });
}

function parseJsonMaybe(value) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseChatFrame(raw) {
  const outer = parseJsonMaybe(raw);

  if (!outer || typeof outer !== "object") {
    return null;
  }

  const payload = parseJsonMaybe(outer.payload ?? outer);

  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.kind !== undefined && payload.kind !== 1) {
    return null;
  }

  const body = parseJsonMaybe(payload.body);

  if (body && typeof body === "object" && body.type !== undefined && body.type !== 1) {
    return null;
  }

  const sender = payload.sender ?? {};
  const bodyText =
    body && typeof body === "object"
      ? body.body
      : typeof payload.body === "string"
        ? payload.body
        : "";
  const text = typeof bodyText === "string" ? bodyText.trim() : "";

  if (!text || text.startsWith("{")) {
    return null;
  }

  const username =
    (body && typeof body === "object" ? body.username : "") ||
    sender.username ||
    sender.display_name ||
    sender.displayName ||
    payload.username ||
    "x_user";
  const id =
    (body && typeof body === "object" ? body.uuid : "") ||
    payload.uuid ||
    outer.uuid ||
    `${username}:${text}`.slice(0, 96);

  return {
    id,
    text,
    user: normalizeHandle(username) || "x_user",
  };
}

async function xFetchJson(url, init = {}) {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

async function getGuestToken(force = false) {
  if (!force && guestToken && Date.now() - guestTokenCreatedAt < guestTokenTtlMs) {
    return guestToken;
  }

  const payload = await xFetchJson("https://api.twitter.com/1.1/guest/activate.json", {
    headers: {
      Authorization: X_WEB_BEARER,
      "User-Agent": X_UA,
    },
    method: "POST",
  });

  if (payload?.guest_token) {
    guestToken = payload.guest_token;
    guestTokenCreatedAt = Date.now();
  }

  return guestToken;
}

function getXHeaders(guestTokenValue) {
  return {
    Authorization: X_WEB_BEARER,
    "User-Agent": X_UA,
    "x-guest-token": guestTokenValue,
  };
}

async function resolveBroadcast(broadcastId) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getGuestToken(attempt === 1);

    if (!token) {
      continue;
    }

    const headers = getXHeaders(token);
    const showPayload = await xFetchJson(
      `https://api.twitter.com/1.1/broadcasts/show.json?ids=${encodeURIComponent(
        broadcastId,
      )}`,
      { headers },
    );
    const broadcast = showPayload?.broadcasts?.[broadcastId];

    if (!broadcast) {
      continue;
    }

    const mediaKey = broadcast.media_key || "";
    const statusPayload = mediaKey
      ? await xFetchJson(
          `https://api.twitter.com/1.1/live_video_stream/status/${encodeURIComponent(
            mediaKey,
          )}?client=web&use_syndication_guest_id=false&cookie_set_host=x.com`,
          { headers },
        )
      : null;

    return {
      chatToken: statusPayload?.chatToken || "",
      id: broadcastId,
      live: broadcast.state === "RUNNING",
      state: broadcast.state || "",
      username: normalizeHandle(
        broadcast.twitter_username || broadcast.username || "",
      ),
    };
  }

  return null;
}

async function accessChat(chatToken) {
  const payload = await xFetchJson("https://proxsee.pscp.tv/api/v2/accessChatPublic", {
    body: JSON.stringify({ chat_token: chatToken }),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": X_UA,
    },
    method: "POST",
  });

  if (!payload?.endpoint || !payload?.access_token) {
    return null;
  }

  return {
    accessToken: payload.access_token,
    endpoint: payload.endpoint,
    roomId: payload.room_id || "",
  };
}

class EventIngestor {
  constructor(url, secret) {
    this.flushing = false;
    this.queue = [];
    this.secret = secret;
    this.timer = null;
    this.url = url;
  }

  enqueue(event) {
    this.queue.push(event);

    if (this.queue.length >= 20) {
      void this.flush();
      return;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, 1_000);
    }
  }

  async flush() {
    if (this.flushing || this.queue.length === 0) {
      return;
    }

    this.flushing = true;
    const events = this.queue.splice(0, 50);

    try {
      const headers = {
        "Content-Type": "application/json",
      };

      if (this.secret) {
        headers.Authorization = `Bearer ${this.secret}`;
      }

      const response = await fetch(this.url, {
        body: JSON.stringify({ events }),
        headers,
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`ingest returned ${response.status}`);
      }

      console.log(`[x-broadcast] ingested ${events.length} message(s)`);
    } catch (error) {
      this.queue = [...events, ...this.queue].slice(0, 500);
      console.error(`[x-broadcast] ingest failed: ${formatError(error)}`);
    } finally {
      this.flushing = false;
    }
  }
}

class XBroadcastWatcher {
  constructor(source, ingestor) {
    this.closed = false;
    this.connecting = false;
    this.fallbackChannel = source.fallbackChannel;
    this.id = source.id;
    this.ingestor = ingestor;
    this.reconnectTimer = null;
    this.seen = new Set();
    this.stateTimer = null;
    this.ws = null;
  }

  start() {
    void this.connect();
    this.stateTimer = setInterval(() => {
      void this.checkState();
    }, 60_000);
  }

  async checkState() {
    if (this.closed) {
      return;
    }

    const info = await resolveBroadcast(this.id);

    if (!info) {
      console.warn(`[x-broadcast:${this.id}] broadcast not found`);
      return;
    }

    if (!info.live) {
      console.log(`[x-broadcast:${this.id}] state=${info.state || "unknown"}`);
      return;
    }

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      await this.connect();
    }
  }

  emit(info, frame) {
    const sourceId = `x-broadcast:${this.id}:${frame.id}`;

    if (this.seen.has(sourceId)) {
      return;
    }

    this.seen.add(sourceId);

    if (this.seen.size > 6_000) {
      this.seen = new Set([...this.seen].slice(-3_000));
    }

    const channel = info.username || this.fallbackChannel || this.id;

    this.ingestor.enqueue({
      author: frame.user,
      channel,
      color: "#e4e4e4",
      platform: "X",
      receivedAt: Date.now(),
      sourceId,
      text: frame.text,
    });
  }

  async backfill(info, access) {
    const payload = await xFetchJson(`${access.endpoint}/chatapi/v1/history`, {
      body: JSON.stringify({
        access_token: access.accessToken,
        cursor: "",
        limit: 40,
        quick_get: true,
        since: null,
      }),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": X_UA,
      },
      method: "POST",
    });

    const frames = Array.isArray(payload?.messages) ? payload.messages : [];

    for (const frame of frames.map(parseChatFrame).filter(Boolean).slice(-15)) {
      this.emit(info, frame);
    }
  }

  async connect() {
    if (this.closed || this.connecting) {
      return;
    }

    this.connecting = true;

    try {
      const info = await resolveBroadcast(this.id);

      if (!info) {
        console.warn(`[x-broadcast:${this.id}] broadcast not found`);
        return;
      }

      if (!info.live) {
        console.log(`[x-broadcast:${this.id}] waiting, state=${info.state || "unknown"}`);
        return;
      }

      if (!info.chatToken) {
        console.warn(`[x-broadcast:${this.id}] broadcast has no public chat token`);
        return;
      }

      const access = await accessChat(info.chatToken);

      if (!access) {
        console.warn(`[x-broadcast:${this.id}] chat access failed`);
        return;
      }

      await this.backfill(info, access);

      const wsUrl = `${access.endpoint.replace(/^http/, "ws")}/chatapi/v1/chatnow`;
      const ws = new WebSocket(wsUrl, {
        headers: {
          Origin: "https://x.com",
          "User-Agent": X_UA,
        },
      });
      this.ws = ws;

      ws.on("open", () => {
        const room = access.roomId || this.id;
        ws.send(
          JSON.stringify({
            kind: 3,
            payload: JSON.stringify({ access_token: access.accessToken, room }),
          }),
        );
        ws.send(
          JSON.stringify({
            kind: 2,
            payload: JSON.stringify({
              body: JSON.stringify({ room }),
              kind: 1,
            }),
          }),
        );
        console.log(
          `[x-broadcast:${this.id}] live chat connected${
            info.username ? ` for @${info.username}` : ""
          }`,
        );
      });

      ws.on("message", (data) => {
        const frame = parseChatFrame(data.toString());

        if (frame) {
          this.emit(info, frame);
        }
      });

      ws.on("close", () => {
        if (!this.closed) {
          this.scheduleReconnect();
        }
      });

      ws.on("error", (error) => {
        console.warn(`[x-broadcast:${this.id}] websocket error: ${formatError(error)}`);
      });
    } finally {
      this.connecting = false;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.closed) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 4_000);
  }

  close() {
    this.closed = true;

    if (this.stateTimer) {
      clearInterval(this.stateTimer);
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.ws?.close();
  }
}

class BroadcastSupervisor {
  constructor(ingestor) {
    this.ingestor = ingestor;
    this.watchers = new Map();
  }

  addSource(source) {
    if (this.watchers.has(source.id)) {
      return;
    }

    const watcher = new XBroadcastWatcher(source, this.ingestor);

    this.watchers.set(source.id, watcher);
    console.log(
      `[x-broadcast] watching ${source.url}${
        source.fallbackChannel ? ` as @${source.fallbackChannel}` : ""
      }`,
    );
    watcher.start();
  }

  async discoverFromHandles(handles) {
    if (handles.length === 0) {
      return;
    }

    const siteBase = getDiscoverySiteBase();

    if (!siteBase) {
      console.warn("[x-broadcast] no site URL available for handle discovery");
      return;
    }

    for (const handle of handles) {
      try {
        const feedUrl = new URL("/api/x-feed", siteBase);

        feedUrl.searchParams.set("handle", handle);

        const response = await fetch(feedUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(18_000),
        });

        if (!response.ok) {
          throw new Error(`feed returned ${response.status}`);
        }

        const payload = await response.json();
        const tweets = Array.isArray(payload?.tweets) ? payload.tweets : [];
        const matches = tweets.flatMap((tweet) =>
          extractBroadcastUrls(
            [tweet.text, tweet.title, tweet.url, ...(tweet.media ?? [])]
              .filter(Boolean)
              .join(" "),
          ),
        );

        for (const url of matches) {
          const id = broadcastIdFromUrl(url);

          if (id) {
            this.addSource({
              fallbackChannel: handle,
              id,
              url: getBroadcastUrl(url),
            });
          }
        }
      } catch (error) {
        console.warn(`[x-broadcast] @${handle} discovery failed: ${formatError(error)}`);
      }
    }
  }
}

function extractBroadcastUrls(value) {
  return Array.from(
    new Set(
      Array.from(
        value.matchAll(
          /(?:https?:\/\/(?:x|twitter)\.com)?\/i\/(?:broadcasts|spaces)\/[A-Za-z0-9]+/gi,
        ),
      ).map((match) => getBroadcastUrl(match[0])),
    ),
  );
}

function getDiscoverySiteBase() {
  const explicitBase = envValue("X_BROADCAST_DISCOVERY_SITE_URL");

  if (explicitBase) {
    return explicitBase;
  }

  const siteUrl = envValue("NEXT_PUBLIC_SITE_URL");

  if (siteUrl) {
    return siteUrl;
  }

  const ingestUrl = envValue("MARKETBUBBLE_INGEST_URL", defaultIngestUrl);

  try {
    return new URL(ingestUrl).origin;
  } catch {
    return "";
  }
}

async function main() {
  const ingestUrl = envValue("MARKETBUBBLE_INGEST_URL", defaultIngestUrl);
  const ingestSecret = envValue("STREAM_EVENT_INGEST_SECRET");
  const directSources = parseBroadcastSources(envValue("X_BROADCAST_URLS"));
  const handles = splitEnvList(envValue("X_BROADCAST_HANDLES")).map(normalizeHandle);
  const handlePollMs = Math.max(
    15_000,
    Number.parseInt(envValue("X_BROADCAST_HANDLE_POLL_MS", `${defaultHandlePollMs}`), 10) ||
      defaultHandlePollMs,
  );

  if (directSources.length === 0 && handles.length === 0) {
    console.log("[x-broadcast] no X_BROADCAST_URLS or X_BROADCAST_HANDLES configured");
    console.log(
      "[x-broadcast] set X_BROADCAST_URLS=handle=https://x.com/i/broadcasts/... for reliable live chat",
    );
    return;
  }

  console.log(`[x-broadcast] ingest target: ${ingestUrl}`);
  if (handles.length > 0) {
    console.log(`[x-broadcast] discovery handles: ${handles.map((handle) => `@${handle}`).join(", ")}`);
  }
  const ingestor = new EventIngestor(ingestUrl, ingestSecret);
  const supervisor = new BroadcastSupervisor(ingestor);

  for (const source of directSources) {
    supervisor.addSource(source);
  }

  await supervisor.discoverFromHandles(handles);

  if (handles.length > 0) {
    setInterval(() => {
      void supervisor.discoverFromHandles(handles);
    }, handlePollMs);
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      console.log(`[x-broadcast] ${signal} received, shutting down`);
      for (const watcher of supervisor.watchers.values()) {
        watcher.close();
      }
      void ingestor.flush().finally(() => process.exit(0));
    });
  }
}

void main().catch((error) => {
  console.error(`[x-broadcast] fatal: ${formatError(error)}`);
  process.exit(1);
});
