"use client";

import type { CSSProperties, FocusEvent as ReactFocusEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiKick, SiTwitch, SiX } from "react-icons/si";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type {
  CommunityChatEvent,
  CommunityChatterEntry,
  CommunityPlatform,
  CommunityTopChatResponse,
} from "@/lib/community-top-chat-types";
import styles from "./CommunityLive.module.css";

const twitchChannel = "jynxzi";
const twitchDisplayName = "Jynxzi";
const kickChannel = {
  channel: "solomission",
  fallbackChatroomId: 2218947,
  displayName: "SoloMission",
};
const xHandle = "MarketBubble";
const kickPusherUrl =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false";
const maxMessages = 340;
const activeWindowMs = 5 * 60 * 1000;
const velocityWindowMs = 60 * 1000;
const retainedVelocityWindowMs = 10 * 60 * 1000;
const topChatStorageKey = "marketbubble-community-top-chat-v1";

const authorColors = [
  "#8a5cff",
  "#39ff14",
  "#f2c94c",
  "#6bdcff",
  "#ff5ca8",
  "#7cf2b1",
  "#ff8a3d",
  "#c7ff5c",
  "#b18cff",
  "#f26b6b",
];
const platformLogoColors: Record<Platform, string> = {
  Kick: "#53fc18",
  Twitch: "#9146ff",
  X: "#e4e4e4",
};

type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline";
type Platform = CommunityPlatform;

type StreamMetricsResponse = {
  kickChannelChatroomIds?: Record<string, number>;
  kickChannelOnline?: Record<string, boolean>;
  kickChannelViewers?: Record<string, number>;
  kickViewers?: number;
  online?: boolean;
  platformViewers?: Record<string, number>;
  totalViewers?: number;
  twitchViewers?: number;
  twitchChannelOnline?: Record<string, boolean>;
  twitchChannelViewers?: Record<string, number>;
  xHandleOnline?: Record<string, boolean>;
  xHandleViewers?: Record<string, number>;
  xViewers?: number;
};

type XFeedTweet = {
  author?: string;
  id?: string;
  metrics?: {
    views?: number | null;
  };
  publishedAt?: string;
  text?: string;
  title?: string;
};

type XFeedResponse = {
  tweets?: XFeedTweet[];
};

type StoredTopChatPayload = {
  chatters?: Record<string, ChatterEntry>;
  seenXPostIds?: string[];
  totalMessages?: number;
};

type ParsedTwitchMessage = {
  author: string;
  authorColor?: string;
  platform: Platform;
  sourceId: string;
  text: string;
};

type TwitchChatMessage = ParsedTwitchMessage & {
  color: string;
  id: string;
  receivedAt: number;
  time: string;
};

type ChatterEntry = CommunityChatterEntry;

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function createFallbackSourceId(platform: Platform, value: string) {
  return `${platform.toLowerCase()}:fallback:${hashString(value)}`;
}

function decodeIrcTag(value = "") {
  return value
    .replace(/\\s/g, " ")
    .replace(/\\:/g, ";")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
}

function parseIrcTags(value = "") {
  return Object.fromEntries(
    value
      .split(";")
      .filter(Boolean)
      .map((tag) => {
        const [key = "", rawValue = ""] = tag.split("=");

        return [key, decodeIrcTag(rawValue)];
      }),
  );
}

function parseTwitchMessage(line: string): ParsedTwitchMessage | null {
  const match = line.match(/^(?:@([^ ]+) )?:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.*)$/);

  if (!match?.[2] || !match[3]) {
    return null;
  }

  const tags = parseIrcTags(match[1]);
  const author = tags["display-name"] || match[2];
  const sentAt = tags["tmi-sent-ts"] || Date.now().toString();
  const sourceId = tags.id
    ? `twitch:${tags.id}`
    : createFallbackSourceId("Twitch", `${author}:${sentAt}:${match[3]}`);

  return {
    author,
    authorColor: tags.color || undefined,
    platform: "Twitch",
    sourceId,
    text: match[3],
  };
}

function parseKickMessage(rawData: string): ParsedTwitchMessage | null {
  try {
    const data = JSON.parse(rawData);

    if (!data?.sender?.username || !data?.content) {
      return null;
    }

    const rawSourceId =
      data.id ??
      data.message_id ??
      data.chatroom_message_id ??
      data.created_at;
    const sourceId = rawSourceId
      ? `kick:${rawSourceId}`
      : createFallbackSourceId("Kick", `${data.sender.username}:${data.content}`);

    return {
      author: data.sender.username,
      authorColor: data.sender.identity?.color,
      platform: "Kick",
      sourceId,
      text: normalizeKickMessage(data.content),
    };
  } catch {
    return null;
  }
}

function normalizeKickMessage(content: string) {
  return content.replace(/\[emote:\d+:([^\]]+)\]/g, ":$1:");
}

function getAuthorColor(author: string) {
  const colorIndex =
    [...author].reduce((hash, character) => hash + character.charCodeAt(0), 0) %
    authorColors.length;

  return authorColors[colorIndex];
}

function formatChatTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function isPlatform(value: unknown): value is Platform {
  return value === "Twitch" || value === "Kick" || value === "X";
}

function cleanXAuthor(value = `@${xHandle}`) {
  return value.replace(/^@/, "").replace(/[^\w]/g, "") || xHandle;
}

function getTweetText(tweet: XFeedTweet) {
  const value = (tweet.title || tweet.text || "New Market Bubble post")
    .replace(/\s+/g, " ")
    .trim();

  return value.length > 220 ? `${value.slice(0, 217)}...` : value;
}

function readStoredTopChat(): StoredTopChatPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawPayload = window.localStorage.getItem(topChatStorageKey);

    if (!rawPayload) {
      return null;
    }

    const payload = JSON.parse(rawPayload) as StoredTopChatPayload;
    const chatters = Object.fromEntries(
      Object.entries(payload.chatters ?? {}).filter(([, chatter]) =>
        Boolean(
          chatter &&
            typeof chatter.author === "string" &&
            typeof chatter.count === "number" &&
            typeof chatter.lastSeen === "number" &&
            isPlatform(chatter.platform),
        ),
      ),
    ) as Record<string, ChatterEntry>;

    return {
      chatters,
      seenXPostIds: Array.isArray(payload.seenXPostIds)
        ? payload.seenXPostIds.filter((id) => typeof id === "string")
        : [],
      totalMessages: Number(payload.totalMessages ?? 0),
    };
  } catch {
    return null;
  }
}

function limitStoredChatters(chatters: Record<string, ChatterEntry>) {
  return Object.fromEntries(
    Object.entries(chatters)
      .toSorted(([, first], [, second]) => second.count - first.count)
      .slice(0, 160),
  ) as Record<string, ChatterEntry>;
}

function mergeTopChatResponse(
  payload: CommunityTopChatResponse,
  updateChatters: (chatters: Record<string, ChatterEntry>) => void,
  updateTotalMessages: (totalMessages: number) => void,
) {
  if (!payload.stored) {
    return;
  }

  updateChatters(payload.chatters);
  updateTotalMessages(payload.totalMessages);
}

function PlatformLogo({ platform }: { platform: Platform }) {
  if (platform === "Kick") {
    return <SiKick aria-hidden="true" />;
  }

  if (platform === "X") {
    return <SiX aria-hidden="true" />;
  }

  return <SiTwitch aria-hidden="true" />;
}

function getConnectionLabel(connectionState: ConnectionState) {
  if (connectionState === "connected") {
    return "Connected";
  }

  if (connectionState === "reconnecting") {
    return "Reconnecting";
  }

  if (connectionState === "offline") {
    return "Offline";
  }

  return "Connecting";
}

export function CommunityLive() {
  const feedRef = useRef<HTMLDivElement>(null);
  const bufferedMessagesRef = useRef<TwitchChatMessage[]>([]);
  const hasInitializedXFeedRef = useRef(false);
  const pausedRef = useRef(false);
  const serverEventQueueRef = useRef<CommunityChatEvent[]>([]);
  const seenXPostIdsRef = useRef<Set<string>>(new Set());
  const [messages, setMessages] = useState<TwitchChatMessage[]>([]);
  const [chatters, setChatters] = useState<Record<string, ChatterEntry>>({});
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [kickChatroomId, setKickChatroomId] = useState<number | null>(
    kickChannel.fallbackChatroomId,
  );
  const [metrics, setMetrics] = useState<StreamMetricsResponse | null>(null);
  const [messageTimes, setMessageTimes] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);

  const appendStampedMessages = useCallback((stampedMessages: TwitchChatMessage[]) => {
    setMessages((currentMessages) =>
      [...currentMessages, ...stampedMessages].slice(-maxMessages),
    );
  }, []);

  const recordMessages = useCallback((incomingMessages: ParsedTwitchMessage[]) => {
    if (incomingMessages.length === 0) {
      return;
    }

    const receivedAt = Date.now();
    const stampedMessages = incomingMessages.map((message, index) => {
      const color = message.authorColor ?? getAuthorColor(message.author);

      return {
        ...message,
        color,
        id: `${message.sourceId}-${receivedAt}-${index}`,
        receivedAt,
        time: formatChatTime(new Date(receivedAt)),
      };
    });

    serverEventQueueRef.current = [
      ...serverEventQueueRef.current,
      ...stampedMessages.map((message) => ({
        author: message.author,
        color: message.color,
        platform: message.platform,
        receivedAt: message.receivedAt,
        sourceId: message.sourceId,
        text: message.text,
      })),
    ].slice(-360);

    setTotalMessages((currentTotal) => currentTotal + stampedMessages.length);
    setMessageTimes((currentTimes) => [
      ...currentTimes.filter((time) => receivedAt - time <= retainedVelocityWindowMs),
      ...stampedMessages.map(() => receivedAt),
    ]);
    setChatters((currentChatters) => {
      const nextChatters = { ...currentChatters };

      for (const message of stampedMessages) {
        const chatterKey = `${message.platform}:${message.author.toLowerCase()}`;
        const previous = nextChatters[chatterKey];

        nextChatters[chatterKey] = {
          author: message.author,
          color: message.color,
          count: (previous?.count ?? 0) + 1,
          lastMessage: message.text,
          lastSeen: receivedAt,
          platform: message.platform,
        };
      }

      return nextChatters;
    });

    if (pausedRef.current) {
      bufferedMessagesRef.current = [
        ...bufferedMessagesRef.current,
        ...stampedMessages,
      ].slice(-maxMessages);
      return;
    }

    appendStampedMessages(stampedMessages);
  }, [appendStampedMessages]);

  const pauseChat = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resumeChat = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);

    if (bufferedMessagesRef.current.length === 0) {
      return;
    }

    appendStampedMessages(bufferedMessagesRef.current);
    bufferedMessagesRef.current = [];
  }, [appendStampedMessages]);

  const handleChatBlur = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      const nextFocusedElement = event.relatedTarget;

      if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) {
        return;
      }

      resumeChat();
    },
    [resumeChat],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedTopChat = readStoredTopChat();

      if (storedTopChat?.chatters) {
        setChatters(storedTopChat.chatters);
      }

      if (storedTopChat?.totalMessages) {
        setTotalMessages(storedTopChat.totalMessages);
      }

      seenXPostIdsRef.current = new Set(storedTopChat?.seenXPostIds ?? []);
      setStorageReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let active = true;

    const loadServerTopChat = async () => {
      try {
        const response = await fetch("/api/community-top-chat", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as CommunityTopChatResponse;

        if (!active) {
          return;
        }

        mergeTopChatResponse(
          payload,
          (nextChatters) => setChatters(nextChatters),
          (nextTotalMessages) =>
            setTotalMessages((currentTotalMessages) =>
              Math.max(currentTotalMessages, nextTotalMessages),
            ),
        );
      } catch {
        // Shared storage is optional; local storage keeps the page useful without it.
      }
    };

    loadServerTopChat();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const flushServerEvents = async () => {
      const events = serverEventQueueRef.current.splice(0, 120);

      if (events.length === 0) {
        return;
      }

      try {
        const response = await fetch("/api/community-top-chat", {
          body: JSON.stringify({ events }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`Community top chat request failed: ${response.status}`);
        }

        const payload = (await response.json()) as CommunityTopChatResponse;

        if (!active) {
          return;
        }

        mergeTopChatResponse(
          payload,
          (nextChatters) => setChatters(nextChatters),
          (nextTotalMessages) =>
            setTotalMessages((currentTotalMessages) =>
              Math.max(currentTotalMessages, nextTotalMessages),
            ),
        );
      } catch {
        serverEventQueueRef.current = [...events, ...serverEventQueueRef.current].slice(-360);
      }
    };

    const interval = window.setInterval(flushServerEvents, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
      void flushServerEvents();
    };
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    try {
      window.localStorage.setItem(
        topChatStorageKey,
        JSON.stringify({
          chatters: limitStoredChatters(chatters),
          seenXPostIds: Array.from(seenXPostIdsRef.current).slice(-500),
          totalMessages,
          updatedAt: Date.now(),
        }),
      );
    } catch {
      // Local storage can be disabled; live chat should continue without persistence.
    }
  }, [chatters, storageReady, totalMessages]);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let openSocketCount = 0;
    let sockets: WebSocket[] = [];
    let disposed = false;

    const markSocketOpen = () => {
      openSocketCount += 1;
      setConnectionState("connected");
    };

    const scheduleReconnect = () => {
      if (disposed) {
        return;
      }

      setConnectionState("reconnecting");

      if (!reconnectTimer) {
        reconnectTimer = setTimeout(connect, 4000);
      }
    };

    const markSocketClosed = () => {
      openSocketCount = Math.max(0, openSocketCount - 1);

      if (openSocketCount === 0) {
        scheduleReconnect();
      }
    };

    const connect = () => {
      reconnectTimer = undefined;
      openSocketCount = 0;
      sockets = [];
      const twitchSocket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
      const kickSocket = kickChatroomId ? new WebSocket(kickPusherUrl) : undefined;

      sockets.push(twitchSocket);

      if (kickSocket) {
        sockets.push(kickSocket);
      }

      twitchSocket.addEventListener("open", () => {
        twitchSocket.send("PASS SCHMOOPIIE");
        twitchSocket.send(`NICK justinfan${Math.floor(Math.random() * 900000) + 100000}`);
        twitchSocket.send("CAP REQ :twitch.tv/tags");
        twitchSocket.send(`JOIN #${twitchChannel}`);
        markSocketOpen();
      });

      twitchSocket.addEventListener("message", (event) => {
        const lines = String(event.data).split("\r\n");
        const incomingMessages: ParsedTwitchMessage[] = [];

        for (const line of lines) {
          if (line.startsWith("PING")) {
            twitchSocket.send("PONG :tmi.twitch.tv");
            continue;
          }

          const message = parseTwitchMessage(line);

          if (message) {
            incomingMessages.push(message);
          }
        }

        recordMessages(incomingMessages);
      });

      twitchSocket.addEventListener("close", markSocketClosed);
      twitchSocket.addEventListener("error", markSocketClosed);

      if (kickSocket) {
        kickSocket.addEventListener("open", markSocketOpen);

        kickSocket.addEventListener("message", (event) => {
          let message: { data?: string; event?: string };

          try {
            message = JSON.parse(String(event.data));
          } catch {
            return;
          }

          if (message.event === "pusher:connection_established") {
            kickSocket.send(
              JSON.stringify({
                event: "pusher:subscribe",
                data: {
                  auth: "",
                  channel: `chatrooms.${kickChatroomId}.v2`,
                },
              }),
            );
            return;
          }

          if (message.event !== "App\\Events\\ChatMessageEvent" || typeof message.data !== "string") {
            return;
          }

          const kickMessage = parseKickMessage(message.data);

          if (!kickMessage) {
            return;
          }

          recordMessages([kickMessage]);
        });

        kickSocket.addEventListener("close", markSocketClosed);
        kickSocket.addEventListener("error", markSocketClosed);
      }
    };

    connect();

    return () => {
      disposed = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      for (const socket of sockets) {
        socket.close();
      }
    };
  }, [kickChatroomId, recordMessages]);

  useEffect(() => {
    const updateMetrics = async () => {
      try {
        const response = await fetch(
          `/api/stream-metrics?twitchChannel=${encodeURIComponent(twitchChannel)}&kickChannel=${encodeURIComponent(kickChannel.channel)}&xHandle=${encodeURIComponent(xHandle)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(`Stream metrics request failed: ${response.status}`);
        }

        const data = (await response.json()) as StreamMetricsResponse;
        setMetrics(data);
        const resolvedKickChatroomId = Number(data.kickChannelChatroomIds?.[kickChannel.channel]);

        if (Number.isFinite(resolvedKickChatroomId) && resolvedKickChatroomId > 0) {
          setKickChatroomId((currentKickChatroomId) =>
            currentKickChatroomId === resolvedKickChatroomId
              ? currentKickChatroomId
              : resolvedKickChatroomId,
          );
        }
      } catch {
        setMetrics(null);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 30_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    let active = true;

    const updateXFeed = async () => {
      try {
        const response = await fetch(`/api/x-feed?handle=${encodeURIComponent(xHandle)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as XFeedResponse;
        const tweets = Array.isArray(payload.tweets) ? payload.tweets.filter((tweet) => tweet.id) : [];
        const hasStoredSeenIds = seenXPostIdsRef.current.size > 0;
        const firstRun = !hasInitializedXFeedRef.current;
        const selectedTweets =
          firstRun && !hasStoredSeenIds
            ? tweets.slice(0, 4).toReversed()
            : tweets
                .filter((tweet) => tweet.id && !seenXPostIdsRef.current.has(tweet.id))
                .toReversed()
                .slice(-8);

        for (const tweet of tweets) {
          if (tweet.id && (firstRun || selectedTweets.includes(tweet))) {
            seenXPostIdsRef.current.add(tweet.id);
          }
        }

        hasInitializedXFeedRef.current = true;

        if (!active || selectedTweets.length === 0) {
          return;
        }

        recordMessages(
          selectedTweets.map((tweet) => ({
            author: cleanXAuthor(tweet.author),
            authorColor: platformLogoColors.X,
            platform: "X",
            sourceId: `x:${tweet.id}`,
            text: getTweetText(tweet),
          })),
        );
      } catch {
        hasInitializedXFeedRef.current = true;
      }
    };

    updateXFeed();
    const interval = window.setInterval(updateXFeed, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [recordMessages, storageReady]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const feed = feedRef.current;

    if (!feed) {
      return;
    }

    feed.scrollTo({
      behavior: "smooth",
      top: feed.scrollHeight,
    });
  }, [messages]);

  const chatterRows = useMemo(() => Object.values(chatters), [chatters]);
  const topChatters = useMemo(
    () =>
      chatterRows
        .toSorted((first, second) => second.count - first.count || second.lastSeen - first.lastSeen)
        .slice(0, 10),
    [chatterRows],
  );
  const activeChatters = useMemo(
    () => chatterRows.filter((chatter) => now - chatter.lastSeen <= activeWindowMs).length,
    [chatterRows, now],
  );
  const messagesPerMinute = useMemo(
    () => messageTimes.filter((time) => now - time <= velocityWindowMs).length,
    [messageTimes, now],
  );
  const maxChatterCount = Math.max(...topChatters.map((chatter) => chatter.count), 1);
  const kickViewers =
    metrics?.kickChannelViewers?.[kickChannel.channel] ?? metrics?.kickViewers ?? 0;
  const twitchViewers =
    metrics?.twitchChannelViewers?.[twitchChannel] ?? metrics?.twitchViewers ?? 0;
  const xViewers = metrics?.xHandleViewers?.[xHandle] ?? metrics?.xViewers ?? 0;
  const totalViewers = metrics?.totalViewers ?? twitchViewers + kickViewers + xViewers;
  const streamIsLive =
    Boolean(metrics?.twitchChannelOnline?.[twitchChannel]) ||
    Boolean(metrics?.kickChannelOnline?.[kickChannel.channel]) ||
    Boolean(metrics?.xHandleOnline?.[xHandle]) ||
    Boolean(metrics?.online);
  const connectionLabel = getConnectionLabel(connectionState);
  const platformViewers: Record<Platform, number> = {
    Kick: kickViewers,
    Twitch: twitchViewers,
    X: xViewers,
  };
  return (
    <section className={styles.shell} aria-label="Market Bubble community">
      <section
        className={`${styles.panel} ${styles.chatPanel}`}
        data-paused={paused ? "true" : undefined}
        aria-label="Live community chat"
        onBlur={handleChatBlur}
        onFocus={pauseChat}
        onMouseEnter={pauseChat}
        onMouseLeave={resumeChat}
      >
        <div className={styles.viewport}>
          <div className={`chat-feed ${styles.chatFeed}`} ref={feedRef} tabIndex={0}>
            {messages.length > 0 ? (
              messages.map((message) => (
                <article className={`chat-message ${styles.communityMessage}`} key={message.id}>
                  <div className="chat-message-meta">
                    <span className="chat-time">{message.time}</span>
                    <span className="chat-author-group">
                      <span
                        aria-label={message.platform}
                        className={`chat-platform-badge chat-platform-badge-${message.platform.toLowerCase()}`}
                        style={{ color: platformLogoColors[message.platform] }}
                      >
                        <PlatformLogo platform={message.platform} />
                      </span>
                      <span className="chat-author" style={{ color: message.color }}>
                        {message.author}
                      </span>
                    </span>
                  </div>
                  <p>{message.text}</p>
                </article>
              ))
            ) : (
              <div className="chat-empty">
                {connectionLabel}. Waiting for live messages from {twitchDisplayName} and{" "}
                {kickChannel.displayName}, plus new @{xHandle} posts.
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className={styles.sideRail}>
        <section className={`${styles.panel} ${styles.statsPanel}`} aria-label="Live stats">
          <div className={styles.viewport}>
            <header className={styles.compactHeader}>
              <h2>Stats</h2>
              <span>{streamIsLive ? "LIVE" : "OFFLINE"}</span>
            </header>

            <div className={`stats-content ${styles.homeStatsContent}`}>
              <dl className="stats-summary">
                <div className="stats-summary-item">
                  <dt>Total viewers</dt>
                  <dd>
                    <AnimatedNumber value={totalViewers} />
                  </dd>
                </div>
                <div className="stats-summary-item">
                  <dt>Active chatters</dt>
                  <dd>
                    <AnimatedNumber value={activeChatters} />
                  </dd>
                </div>
                <div className="stats-summary-item">
                  <dt>Total messages</dt>
                  <dd>
                    <AnimatedNumber value={totalMessages} />
                  </dd>
                </div>
                <div className="stats-summary-item">
                  <dt>Messages / min</dt>
                  <dd>
                    <AnimatedNumber value={messagesPerMinute} />
                  </dd>
                </div>
              </dl>

              <div className="stats-platforms" aria-label="Viewers by platform">
                {(["Twitch", "Kick", "X"] as const).map((platform) => {
                  const platformCount = platformViewers[platform];
                  const platformShare =
                    totalViewers === 0 ? 0 : Math.round((platformCount / totalViewers) * 100);

                  return (
                    <div className="stats-platform-row" key={platform}>
                      <div className="stats-platform-label">
                        <span
                          className={`stats-platform-logo stats-platform-logo-${platform.toLowerCase()}`}
                        >
                          <PlatformLogo platform={platform} />
                        </span>
                        <span>{platform}</span>
                      </div>
                      <div className="stats-platform-value">
                        <AnimatedNumber className="stats-platform-count" value={platformCount} />
                        <AnimatedNumber
                          className="stats-platform-share"
                          suffix="%"
                          value={platformShare}
                        />
                      </div>
                      <div
                        className={`stats-platform-bar stats-platform-bar-${platform.toLowerCase()}`}
                        style={{ "--platform-share": `${platformShare}%` } as CSSProperties}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.chatterPanel}`} aria-label="Top 10 chatters">
          <div className={styles.viewport}>
            <header className={styles.compactHeader}>
              <h2>Top 10 Chatters</h2>
            </header>

            <div className={styles.chatterList}>
              {topChatters.length > 0 ? (
                topChatters.map((chatter, index) => {
                  const share = (chatter.count / maxChatterCount) * 100;

                  return (
                    <article className={styles.chatterRow} key={`${chatter.platform}-${chatter.author}`}>
                      <span className={styles.rank}>{index + 1}</span>
                      <div className={styles.chatterBody}>
                        <div className={styles.chatterMeta}>
                          <span className="chat-author-group">
                            <span
                              aria-label={chatter.platform}
                              className={`chat-platform-badge chat-platform-badge-${chatter.platform.toLowerCase()}`}
                              style={{ color: platformLogoColors[chatter.platform] }}
                            >
                              <PlatformLogo platform={chatter.platform} />
                            </span>
                            <strong
                              style={
                                { "--community-author-color": chatter.color } as CSSProperties
                              }
                            >
                              {chatter.author}
                            </strong>
                          </span>
                          <span>{formatNumber(chatter.count)} msgs</span>
                        </div>
                        <p>{chatter.lastMessage}</p>
                        <div className={styles.chatterTrack} aria-hidden="true">
                          <span
                            style={
                              { "--community-bar-width": `${share}%` } as CSSProperties
                            }
                          />
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className={styles.emptyState}>
                  <span>Listening</span>
                  <p>Top chatters will populate from real Twitch, Kick, and X activity received on this page.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </aside>
    </section>
  );
}
