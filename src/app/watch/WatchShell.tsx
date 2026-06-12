/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiKick, SiTwitch, SiX } from "react-icons/si";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { AggregatedChat } from "@/components/AggregatedChat";
import type { ChannelOption, Platform, SourceSet } from "@/components/AggregatedChat";
import type { CommunityChatEvent } from "@/lib/community-top-chat-types";
import styles from "./watch.module.css";

const twitchVideoSrc =
  "https://player.twitch.tv/?channel=fazebanks&parent=127.0.0.1&parent=localhost&parent=marketbubble.vercel.app&muted=true&autoplay=true";
const collapsedLeftPanelWidth = 44;
const collapsedChatPanelWidth = 44;
const expandedChatPanelWidth = 300;
const maxChatPanelFallbackWidth = 1600;
const minExpandedChatPanelWidth = 180;
const minExpandedLeftPanelWidth = 120;
const maxLeftPanelWidth = 250;
const streamChatOverlayInset = 14;
const resizeStep = 16;
const watchTwitchChannels = ["fazebanks"];
const watchKickChannels = ["ansem"];
const watchXHandles = ["Banks", "fazebanks", "blknoiz06", "Ansem"];
const watchChannelValue = "both";
const watchPlatforms: Platform[] = ["X", "Twitch", "Kick"];
const watchStatsSourceOptions = [
  { label: "Ansem", value: "kick" },
  { label: "Banks", value: "twitch" },
  { label: "Both", value: "both" },
] as const;
const newsSourceAvatarHandles: Record<string, string> = {
  "BeInCrypto": "beincrypto",
  "Bitcoin Magazine": "BitcoinMagazine",
  "Blockworks": "Blockworks_",
  "CoinDesk": "CoinDesk",
  "Cointelegraph": "Cointelegraph",
  "CryptoSlate": "CryptoSlate",
  "Decrypt": "DecryptMedia",
  "The Block": "TheBlock__",
};
const sentimentSeriesColors = {
  bearish: "#ff6472",
  bullish: "#53fc18",
} as const;
const leftPanelTabs = [
  { label: "News", value: "news" },
  { label: "Polymarket", value: "polymarket" },
] as const;
const newswireLivePollMs = 30_000;
const polymarketLivePollMs = 25_000;
const sentimentWindowMs = 5 * 60 * 1000;
const sentimentRateWindowMs = 60 * 1000;
const trendingTermsWindowMs = 2 * 60 * 1000;
const minSentimentSample = 4;
const bullWords = [
  "moon",
  "mooning",
  "pump",
  "pumping",
  "bull",
  "bullish",
  "lfg",
  "green",
  "buy",
  "buying",
  "long",
  "longing",
  "ath",
  "breakout",
  "hodl",
  "send",
  "sending",
  "up",
  "rocket",
  "based",
  "wagmi",
];
const bearWords = [
  "dump",
  "dumping",
  "bear",
  "bearish",
  "rug",
  "rugged",
  "rekt",
  "ngmi",
  "sell",
  "selling",
  "short",
  "shorting",
  "red",
  "liquidated",
  "crash",
  "crashing",
  "dead",
  "scam",
  "cooked",
  "down",
  "rip",
  "over",
];
const chatTrendStopWords = new Set([
  "about",
  "after",
  "again",
  "aint",
  "all",
  "also",
  "and",
  "are",
  "because",
  "been",
  "being",
  "bro",
  "but",
  "can",
  "chat",
  "could",
  "damn",
  "did",
  "does",
  "doing",
  "dont",
  "emote",
  "even",
  "for",
  "from",
  "get",
  "got",
  "had",
  "has",
  "have",
  "hes",
  "his",
  "how",
  "http",
  "https",
  "just",
  "kekw",
  "like",
  "lol",
  "lmao",
  "man",
  "not",
  "now",
  "one",
  "out",
  "really",
  "see",
  "she",
  "that",
  "the",
  "their",
  "then",
  "there",
  "they",
  "this",
  "too",
  "was",
  "what",
  "when",
  "where",
  "who",
  "why",
  "with",
  "would",
  "ansem",
  "banks",
  "blknoiz06",
  "fazebanks",
  "yeah",
  "yes",
  "you",
  "your",
]);
const bullPattern = compileSentimentPattern(bullWords);
const bearPattern = compileSentimentPattern(bearWords);
const emptyWatchSources: SourceSet = {
  kickChannels: [],
  twitchChannels: watchTwitchChannels,
  xHandles: watchXHandles,
};

function ignoreChannelChange() {}

function haveSameIds<T extends { id: string }>(first: T[] | undefined, second: T[] | undefined) {
  if (!first || !second || first.length !== second.length) {
    return false;
  }

  return first.every((item, index) => item.id === second[index]?.id);
}

function areWatchStatsEqual(first: WatchStats, second: WatchStats) {
  return (
    first.activeChatters === second.activeChatters &&
    first.bearVotes === second.bearVotes &&
    first.bullVotes === second.bullVotes &&
    first.messagesPerMinute === second.messagesPerMinute &&
    first.online === second.online &&
    first.sampleSize === second.sampleSize &&
    first.totalViewers === second.totalViewers &&
    first.platformViewers.Kick === second.platformViewers.Kick &&
    first.platformViewers.Twitch === second.platformViewers.Twitch &&
    first.platformViewers.X === second.platformViewers.X
  );
}

function areTrendingTermsEqual(
  first: WatchTrendingTerm[],
  second: WatchTrendingTerm[],
) {
  return (
    first.length === second.length &&
    first.every((term, index) => {
      const nextTerm = second[index];

      return (
        nextTerm &&
        term.count === nextTerm.count &&
        term.id === nextTerm.id &&
        term.label === nextTerm.label &&
        term.share === nextTerm.share
      );
    })
  );
}

type StreamMetricsResponse = {
  online?: boolean;
  platformViewers?: Record<Platform, number>;
  kickChannelChatroomIds?: Record<string, number>;
  totalViewers?: number;
};

type LeftPanelTabValue = (typeof leftPanelTabs)[number]["value"];

type WatchNewsItem = {
  avatar?: string;
  handle?: string;
  id: string;
  kind: "tweet" | "news";
  name: string;
  source: string;
  text: string;
  ts: number;
  url: string;
};

type WatchNewswireResponse = {
  error?: string;
  fetchedAt?: string;
  items: WatchNewsItem[];
};

type WatchMarketCategory = "crypto" | "ai" | "tech" | "finance";

type WatchPolymarketMarket = {
  binary?: boolean;
  categories: WatchMarketCategory[];
  closesAt: string | null;
  dayChange?: number;
  id: string;
  image: string | null;
  liquidity: number;
  primaryCategory: WatchMarketCategory;
  probability: {
    label: string;
    value: number;
  } | null;
  question: string;
  title: string;
  url: string;
  volume: number;
  volume24h: number;
};

type WatchPolymarketResponse = {
  error?: string;
  fetchedAt?: string;
  markets: WatchPolymarketMarket[];
};

function haveSameMarketSnapshots(
  first: WatchPolymarketMarket[] | undefined,
  second: WatchPolymarketMarket[] | undefined,
) {
  if (!first || !second || first.length !== second.length) {
    return false;
  }

  return first.every((market, index) => {
    const nextMarket = second[index];

    if (!nextMarket) {
      return false;
    }

    return (
      market.id === nextMarket.id &&
      market.question === nextMarket.question &&
      market.closesAt === nextMarket.closesAt &&
      market.probability?.label === nextMarket.probability?.label &&
      market.probability?.value === nextMarket.probability?.value &&
      market.volume24h === nextMarket.volume24h &&
      market.dayChange === nextMarket.dayChange
    );
  });
}

type WatchStats = {
  activeChatters: number;
  bearVotes: number;
  bullVotes: number;
  messagesPerMinute: number;
  online: boolean;
  platformViewers: Record<Platform, number>;
  sampleSize: number;
  totalViewers: number;
};

type WatchTrendingTerm = {
  count: number;
  id: string;
  label: string;
  share: number;
};

type WatchStatsSourceValue = (typeof watchStatsSourceOptions)[number]["value"];

type StreamChatOverlayPosition = {
  x: number;
  y: number;
};

type StreamChatOverlayDrag = {
  initialX: number;
  initialY: number;
  pointerX: number;
  pointerY: number;
};

const emptyWatchStats: WatchStats = {
  activeChatters: 0,
  bearVotes: 0,
  bullVotes: 0,
  messagesPerMinute: 0,
  online: false,
  platformViewers: {
    Kick: 0,
    Twitch: 0,
    X: 0,
  },
  sampleSize: 0,
  totalViewers: 0,
};

function compileSentimentPattern(words: string[]) {
  return new RegExp(`\\b(?:${Array.from(new Set(words)).join("|")})\\b`, "i");
}

function scoreSentiment(text: string) {
  return {
    bear: bearPattern.test(text) ? 1 : 0,
    bull: bullPattern.test(text) ? 1 : 0,
  };
}

function normalizeTrendToken(rawToken: string) {
  return rawToken
    .replace(/^[@#]/, "")
    .replace(/[^\w$]/g, "")
    .toLowerCase();
}

function getTrendLabel(rawToken: string, normalizedToken: string) {
  return rawToken.startsWith("$")
    ? `$${normalizedToken.replace(/^\$/, "").toUpperCase()}`
    : normalizedToken;
}

function getTrendingTerms(events: CommunityChatEvent[], now: number) {
  const terms = new Map<string, { count: number; id: string; label: string }>();
  const recentEvents = events.filter(
    (event) => now - event.receivedAt <= trendingTermsWindowMs,
  );

  for (const event of recentEvents) {
    const messageTerms = new Set<string>();
    const tokens =
      event.text
        .replace(/https?:\/\/\S+/g, " ")
        .match(/[$@#]?[a-zA-Z][a-zA-Z0-9_]{2,}/g) ?? [];

    for (const rawToken of tokens) {
      const normalizedToken = normalizeTrendToken(rawToken);
      const comparableToken = normalizedToken.replace(/^\$/, "");

      if (
        comparableToken.length < 3 ||
        comparableToken.length > 22 ||
        /^\d+$/.test(comparableToken) ||
        chatTrendStopWords.has(comparableToken)
      ) {
        continue;
      }

      messageTerms.add(normalizedToken);
    }

    for (const termId of messageTerms) {
      const currentTerm = terms.get(termId);

      if (currentTerm) {
        currentTerm.count += 1;
        continue;
      }

      terms.set(termId, {
        count: 1,
        id: termId,
        label: getTrendLabel(termId, termId),
      });
    }
  }

  const sortedTerms = Array.from(terms.values())
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label))
    .slice(0, 3);
  const highestCount = Math.max(...sortedTerms.map((term) => term.count), 1);

  return sortedTerms.map((term) => ({
    ...term,
    share: Math.round((term.count / highestCount) * 100),
  }));
}

function eventMatchesSources(event: CommunityChatEvent, sources: SourceSet) {
  const channel = event.channel?.toLowerCase();
  const twitchChannels = sources.twitchChannels.map((source) => source.toLowerCase());
  const kickChannels = sources.kickChannels.map((source) => source.channel.toLowerCase());
  const xHandles = sources.xHandles.map((source) => source.toLowerCase());

  if (event.platform === "Twitch") {
    return channel ? twitchChannels.includes(channel) : twitchChannels.length > 0;
  }

  if (event.platform === "Kick") {
    return channel ? kickChannels.includes(channel) : kickChannels.length > 0;
  }

  return channel ? xHandles.includes(channel) : xHandles.length > 0;
}

function getWatchStatsSources(
  sourceValue: WatchStatsSourceValue,
  sources: SourceSet,
): SourceSet {
  return {
    kickChannels: sourceValue === "twitch" ? [] : sources.kickChannels,
    twitchChannels: sourceValue === "kick" ? [] : sources.twitchChannels,
    xHandles: sourceValue === "both" ? sources.xHandles : [],
  };
}

function getSentimentSummary(stats: WatchStats) {
  const directionalVotes = stats.bullVotes + stats.bearVotes;

  if (directionalVotes < minSentimentSample) {
    return {
      bearShare: 50,
      bullShare: 50,
      label: "Neutral",
      sampleSize: directionalVotes,
      score: 50,
      tone: "neutral",
    };
  }

  const score = Math.round((stats.bullVotes / directionalVotes) * 100);

  return {
    bearShare: 100 - score,
    bullShare: score,
    label: score >= 58 ? "Bullish" : score <= 42 ? "Bearish" : "Neutral",
    sampleSize: directionalVotes,
    score,
    tone: score >= 58 ? "bullish" : score <= 42 ? "bearish" : "neutral",
  };
}

type PercentageBarSeries = {
  color: string;
  data: number;
  id: string;
  label: string;
  legendShape?: "circle" | "square";
};

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function PercentageBarChart({
  barMinSize = 12,
  borderRadius = 1000,
  height = 48,
  legendFormat = "value-label",
  series,
  stackGap = 2,
}: {
  barMinSize?: number;
  borderRadius?: number;
  height?: number;
  legendFormat?: "label-value" | "value-label";
  series: PercentageBarSeries[];
  stackGap?: number;
}) {
  const normalizedSeries = series.map((seriesItem) => ({
    ...seriesItem,
    data: clampPercentage(seriesItem.data),
  }));

  return (
    <div
      className={styles.percentageBarChart}
      style={
        {
          "--percentage-bar-height": `${height}px`,
          "--percentage-bar-min-size": `${barMinSize}px`,
          "--percentage-bar-radius": `${borderRadius}px`,
          "--percentage-bar-stack-gap": `${stackGap}px`,
        } as CSSProperties
      }
    >
      <div className={styles.percentageBarTrack} aria-hidden="true">
        {normalizedSeries.map((seriesItem) => (
          <span
            className={styles.percentageBarSegment}
            data-empty={seriesItem.data === 0 ? "true" : undefined}
            key={seriesItem.id}
            style={
              {
                "--percentage-bar-color": seriesItem.color,
                "--percentage-bar-share": `${seriesItem.data}%`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className={styles.percentageBarLegend}>
        {normalizedSeries.map((seriesItem) => (
          <div
            className={styles.percentageBarLegendEntry}
            key={seriesItem.id}
            style={{ "--percentage-bar-color": seriesItem.color } as CSSProperties}
          >
            <span
              className={styles.percentageBarLegendMarker}
              data-shape={seriesItem.legendShape ?? "circle"}
            />
            <span>
              {legendFormat === "label-value"
                ? `${seriesItem.label} - ${Math.round(seriesItem.data)}%`
                : `${Math.round(seriesItem.data)}% ${seriesItem.label.toLowerCase()}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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

function formatFeedTime(timestamp: number) {
  const elapsedMs = Date.now() - timestamp;
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));

  if (elapsedMinutes < 1) {
    return "now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h`;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(timestamp));
}

function formatMarketDate(value: string | null) {
  if (!value) {
    return "Open";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function getMarketYesValue(probability: WatchPolymarketMarket["probability"]) {
  if (!probability) {
    return null;
  }

  const probabilityValue = clampPercentage(probability.value);

  return probability.label.toLowerCase() === "no"
    ? 100 - probabilityValue
    : probabilityValue;
}

function getTweetAvatarUrl(handle: string | undefined) {
  if (!handle) {
    return null;
  }

  return `https://unavatar.io/twitter/${encodeURIComponent(handle)}`;
}

function getNewswireAvatarUrl(item: WatchNewsItem) {
  if (item.avatar) {
    return item.avatar;
  }

  if (item.kind === "tweet") {
    return getTweetAvatarUrl(item.handle);
  }

  return getTweetAvatarUrl(newsSourceAvatarHandles[item.source] ?? item.handle);
}

async function resolveKickChatroomIds(channels: string[]) {
  const metricsUrl = new URL("/api/stream-metrics", window.location.origin);

  for (const channel of channels) {
    metricsUrl.searchParams.append("kickChannel", channel);
  }

  const response = await fetch(metricsUrl, { cache: "no-store" });
  const payload = (await response.json()) as StreamMetricsResponse;

  return Object.fromEntries(
    channels.flatMap((channel) => {
      const chatroomId = Number(payload.kickChannelChatroomIds?.[channel]);

      return Number.isFinite(chatroomId) && chatroomId > 0 ? [[channel, chatroomId]] : [];
    }),
  ) as Record<string, number>;
}

export function WatchShell() {
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [leftPanelTabValue, setLeftPanelTabValue] = useState<LeftPanelTabValue>("news");
  const [leftPanelWidth, setLeftPanelWidth] = useState(maxLeftPanelWidth);
  const [watchNewswire, setWatchNewswire] = useState<WatchNewswireResponse | null>(null);
  const [watchNewswireError, setWatchNewswireError] = useState<string | null>(null);
  const [watchPolymarket, setWatchPolymarket] =
    useState<WatchPolymarketResponse | null>(null);
  const [watchPolymarketError, setWatchPolymarketError] = useState<string | null>(null);
  const [resizingLeftPanel, setResizingLeftPanel] = useState(false);
  const [chatPanelCollapsed, setChatPanelCollapsed] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(expandedChatPanelWidth);
  const [chatPanelFullscreen, setChatPanelFullscreen] = useState(false);
  const [resizingChatPanel, setResizingChatPanel] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatViewMode, setChatViewMode] = useState<"chatters" | "messages">("messages");
  const [selectedStatsSourceValue, setSelectedStatsSourceValue] =
    useState<WatchStatsSourceValue>("both");
  const [streamStatsCollapsed, setStreamStatsCollapsed] = useState(false);
  const [streamFullscreen, setStreamFullscreen] = useState(false);
  const [streamChatOverlayEnabled, setStreamChatOverlayEnabled] = useState(true);
  const [streamChatOverlayPosition, setStreamChatOverlayPosition] =
    useState<StreamChatOverlayPosition>({ x: 24, y: 24 });
  const [watchStats, setWatchStats] = useState<WatchStats>(emptyWatchStats);
  const [watchTrendingTerms, setWatchTrendingTerms] = useState<WatchTrendingTerm[]>([]);
  const [visibleChatPlatforms, setVisibleChatPlatforms] =
    useState<Platform[]>(watchPlatforms);
  const [watchSources, setWatchSources] = useState<SourceSet>(emptyWatchSources);
  const watchRef = useRef<HTMLElement>(null);
  const streamViewportRef = useRef<HTMLDivElement>(null);
  const streamChatOverlayRef = useRef<HTMLDivElement>(null);
  const streamChatOverlayDragRef = useRef<StreamChatOverlayDrag | null>(null);
  const streamChatOverlayAbortControllerRef = useRef<AbortController | null>(null);
  const leftPanelWidthRef = useRef(maxLeftPanelWidth);
  const pendingLeftPanelRawWidthRef = useRef(maxLeftPanelWidth);
  const pendingLeftPanelWidthRef = useRef(maxLeftPanelWidth);
  const leftPanelResizeFrameRef = useRef<number | null>(null);
  const resizingLeftPanelRef = useRef(false);
  const chatPanelWidthRef = useRef(expandedChatPanelWidth);
  const pendingChatPanelRawWidthRef = useRef(expandedChatPanelWidth);
  const pendingChatPanelWidthRef = useRef(expandedChatPanelWidth);
  const chatPanelResizeFrameRef = useRef<number | null>(null);
  const resizingChatPanelRef = useRef(false);
  const resizeEndAbortControllerRef = useRef<AbortController | null>(null);
  const sentimentSummary = useMemo(() => getSentimentSummary(watchStats), [watchStats]);
  const selectedStatsSourceIndex = useMemo(() => Math.max(
    0,
    watchStatsSourceOptions.findIndex(
      (option) => option.value === selectedStatsSourceValue,
    ),
  ), [selectedStatsSourceValue]);
  const statsSwitcherStyle = useMemo(() => ({
    "--watch-stats-active-offset":
      selectedStatsSourceIndex === 0
        ? "0px"
        : `calc(${selectedStatsSourceIndex * 100}% + ${
            selectedStatsSourceIndex * 0.28
          }rem)`,
  }) as CSSProperties, [selectedStatsSourceIndex]);
  const visibleLeftPanelWidth = leftPanelCollapsed ? collapsedLeftPanelWidth : leftPanelWidth;
  const visibleChatPanelWidth = chatPanelCollapsed
    ? collapsedChatPanelWidth
    : chatPanelWidth;
  const watchChannelOptions = useMemo<ChannelOption[]>(() => [
    {
      ...watchSources,
      label: "Watch",
      value: watchChannelValue,
    },
  ], [watchSources]);
  const watchStyle = useMemo(() => ({
    "--watch-chat-panel-width": `${visibleChatPanelWidth}px`,
    "--watch-left-panel-width": `${visibleLeftPanelWidth}px`,
  }) as CSSProperties, [visibleChatPanelWidth, visibleLeftPanelWidth]);
  const streamChatOverlayStyle = useMemo(() => ({
    "--stream-chat-overlay-x": `${streamChatOverlayPosition.x}px`,
    "--stream-chat-overlay-y": `${streamChatOverlayPosition.y}px`,
  }) as CSSProperties, [streamChatOverlayPosition.x, streamChatOverlayPosition.y]);
  const watchNewsItems = useMemo(() => watchNewswire?.items ?? [], [watchNewswire]);
  const watchMarkets = useMemo(() => watchPolymarket?.markets ?? [], [watchPolymarket]);

  useEffect(() => {
    leftPanelWidthRef.current = leftPanelWidth;
  }, [leftPanelWidth]);

  useEffect(() => {
    chatPanelWidthRef.current = chatPanelWidth;
  }, [chatPanelWidth]);

  useEffect(() => {
    return () => {
      if (leftPanelResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(leftPanelResizeFrameRef.current);
      }

      if (chatPanelResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(chatPanelResizeFrameRef.current);
      }

      resizeEndAbortControllerRef.current?.abort();
      streamChatOverlayAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (leftPanelCollapsed || leftPanelTabValue !== "news") {
      return;
    }

    let active = true;

    async function updateNewswire() {
      try {
        const response = await fetch("/api/watch-newswire", { cache: "no-store" });
        const payload = (await response.json()) as WatchNewswireResponse;

        if (!active) {
          return;
        }

        setWatchNewswire((currentPayload) =>
          haveSameIds(currentPayload?.items, payload.items) ? currentPayload : payload,
        );
        setWatchNewswireError(
          response.ok ? payload.error ?? null : payload.error ?? "Unable to load news.",
        );
      } catch {
        if (active) {
          setWatchNewswireError("Unable to load news.");
        }
      }
    }

    updateNewswire();
    const intervalId = window.setInterval(updateNewswire, newswireLivePollMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [leftPanelCollapsed, leftPanelTabValue]);

  useEffect(() => {
    if (leftPanelCollapsed || leftPanelTabValue !== "polymarket") {
      return;
    }

    let active = true;

    async function updatePolymarketMarkets() {
      try {
        const response = await fetch("/api/polymarket-markets", { cache: "no-store" });
        const payload = (await response.json()) as WatchPolymarketResponse;

        if (!active) {
          return;
        }

        setWatchPolymarket((currentPayload) =>
          haveSameMarketSnapshots(currentPayload?.markets, payload.markets)
            ? currentPayload
            : payload,
        );
        setWatchPolymarketError(
          response.ok ? payload.error ?? null : payload.error ?? "Unable to load markets.",
        );
      } catch {
        if (active) {
          setWatchPolymarketError("Unable to load markets.");
        }
      }
    }

    updatePolymarketMarkets();
    const intervalId = window.setInterval(updatePolymarketMarkets, polymarketLivePollMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [leftPanelCollapsed, leftPanelTabValue]);

  useEffect(() => {
    function handleFullscreenChange() {
      const isStreamFullscreen = document.fullscreenElement === streamViewportRef.current;

      setStreamFullscreen(isStreamFullscreen);

      if (isStreamFullscreen) {
        setStreamChatOverlayPosition((currentPosition) =>
          clampStreamChatOverlayPosition(currentPosition),
        );
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function updateKickSources() {
      try {
        const chatroomIds = await resolveKickChatroomIds(watchKickChannels);

        if (!active) {
          return;
        }

        setWatchSources({
          kickChannels: watchKickChannels.flatMap((channel) => {
            const chatroomId = chatroomIds[channel];

            return chatroomId ? [{ channel, chatroomId }] : [];
          }),
          twitchChannels: watchTwitchChannels,
          xHandles: watchXHandles,
        });
      } catch {
        if (active) {
          setWatchSources(emptyWatchSources);
        }
      }
    }

    updateKickSources();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const selectedStatsSources = getWatchStatsSources(
      selectedStatsSourceValue,
      watchSources,
    );

    if (
      selectedStatsSources.twitchChannels.length === 0 &&
      selectedStatsSources.kickChannels.length === 0 &&
      selectedStatsSources.xHandles.length === 0
    ) {
      return;
    }

    let active = true;

    async function updateWatchStats() {
      try {
        const metricsUrl = new URL("/api/stream-metrics", window.location.origin);

        for (const twitchChannel of selectedStatsSources.twitchChannels) {
          metricsUrl.searchParams.append("twitchChannel", twitchChannel);
        }

        for (const kickChannel of selectedStatsSources.kickChannels) {
          metricsUrl.searchParams.append("kickChannel", kickChannel.channel);
        }

        for (const xHandle of selectedStatsSources.xHandles) {
          metricsUrl.searchParams.append("xHandle", xHandle);
        }

        const [metricsResponse, eventsResponse] = await Promise.all([
          fetch(metricsUrl, { cache: "no-store" }),
          fetch("/api/community-live-events?limit=260", { cache: "no-store" }),
        ]);
        const metricsPayload = (await metricsResponse.json()) as StreamMetricsResponse;
        const eventsPayload = (await eventsResponse.json()) as {
          events?: CommunityChatEvent[];
        };
        const now = Date.now();
        const matchingEvents = (eventsPayload.events ?? [])
          .filter((event) => eventMatchesSources(event, selectedStatsSources))
          .filter((event) => now - event.receivedAt <= sentimentWindowMs);
        const activeChatters = new Set(
          matchingEvents.map((event) => `${event.platform}:${event.author.toLowerCase()}`),
        ).size;
        const messagesPerMinute = matchingEvents.filter(
          (event) => now - event.receivedAt <= sentimentRateWindowMs,
        ).length;
        const sentimentVotes = matchingEvents.reduce(
          (votes, event) => {
            const sentiment = scoreSentiment(event.text);

            return {
              bearVotes: votes.bearVotes + sentiment.bear,
              bullVotes: votes.bullVotes + sentiment.bull,
            };
          },
          { bearVotes: 0, bullVotes: 0 },
        );
        const nextTrendingTerms = getTrendingTerms(matchingEvents, now);

        if (!active) {
          return;
        }

        const nextWatchStats = {
          activeChatters,
          bearVotes: sentimentVotes.bearVotes,
          bullVotes: sentimentVotes.bullVotes,
          messagesPerMinute,
          online: Boolean(metricsPayload.online),
          platformViewers: {
            Kick: Number(metricsPayload.platformViewers?.Kick ?? 0),
            Twitch: Number(metricsPayload.platformViewers?.Twitch ?? 0),
            X: Number(metricsPayload.platformViewers?.X ?? 0),
          },
          sampleSize: matchingEvents.length,
          totalViewers: Number(metricsPayload.totalViewers ?? 0),
        };

        setWatchStats((currentStats) =>
          areWatchStatsEqual(currentStats, nextWatchStats) ? currentStats : nextWatchStats,
        );
        setWatchTrendingTerms((currentTerms) =>
          areTrendingTermsEqual(currentTerms, nextTrendingTerms)
            ? currentTerms
            : nextTrendingTerms,
        );
      } catch {
        if (active) {
          setWatchStats((currentStats) =>
            areWatchStatsEqual(currentStats, emptyWatchStats) ? currentStats : emptyWatchStats,
          );
          setWatchTrendingTerms((currentTerms) =>
            currentTerms.length === 0 ? currentTerms : [],
          );
        }
      }
    }

    updateWatchStats();
    const intervalId = window.setInterval(updateWatchStats, 12_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [selectedStatsSourceValue, watchSources]);

  function setWatchWidthVariable(propertyName: string, width: number) {
    watchRef.current?.style.setProperty(propertyName, `${Math.round(width)}px`);
  }

  function scheduleLeftPanelWidthVariable(width: number) {
    pendingLeftPanelWidthRef.current = width;

    if (leftPanelResizeFrameRef.current !== null) {
      return;
    }

    leftPanelResizeFrameRef.current = window.requestAnimationFrame(() => {
      leftPanelResizeFrameRef.current = null;
      setWatchWidthVariable(
        "--watch-left-panel-width",
        pendingLeftPanelWidthRef.current,
      );
    });
  }

  function scheduleChatPanelWidthVariable(width: number) {
    pendingChatPanelWidthRef.current = width;

    if (chatPanelResizeFrameRef.current !== null) {
      return;
    }

    chatPanelResizeFrameRef.current = window.requestAnimationFrame(() => {
      chatPanelResizeFrameRef.current = null;
      setWatchWidthVariable(
        "--watch-chat-panel-width",
        pendingChatPanelWidthRef.current,
      );
    });
  }

  function flushLeftPanelWidthVariable() {
    if (leftPanelResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(leftPanelResizeFrameRef.current);
      leftPanelResizeFrameRef.current = null;
    }

    setWatchWidthVariable("--watch-left-panel-width", pendingLeftPanelWidthRef.current);
  }

  function flushChatPanelWidthVariable() {
    if (chatPanelResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(chatPanelResizeFrameRef.current);
      chatPanelResizeFrameRef.current = null;
    }

    setWatchWidthVariable("--watch-chat-panel-width", pendingChatPanelWidthRef.current);
  }

  function getLeftPanelWidthFromPointer(clientX: number) {
    const watchRect = watchRef.current?.getBoundingClientRect();

    if (!watchRect) {
      return null;
    }

    return clientX - watchRect.left - 8;
  }

  function previewLeftPanelWidthFromPointer(clientX: number) {
    const nextWidth = getLeftPanelWidthFromPointer(clientX);

    if (nextWidth === null) {
      return;
    }

    pendingLeftPanelRawWidthRef.current = nextWidth;
    scheduleLeftPanelWidthVariable(
      nextWidth < minExpandedLeftPanelWidth
        ? collapsedLeftPanelWidth
        : Math.min(nextWidth, maxLeftPanelWidth),
    );
  }

  function commitLeftPanelWidth(nextWidth: number) {
    if (nextWidth < minExpandedLeftPanelWidth) {
      pendingLeftPanelWidthRef.current = collapsedLeftPanelWidth;
      flushLeftPanelWidthVariable();
      setLeftPanelCollapsed(true);
      return;
    }

    const clampedWidth = Math.min(nextWidth, maxLeftPanelWidth);
    leftPanelWidthRef.current = clampedWidth;
    pendingLeftPanelWidthRef.current = clampedWidth;
    flushLeftPanelWidthVariable();
    setLeftPanelCollapsed(false);
    setLeftPanelWidth(clampedWidth);
  }

  function clearGlobalResizeEndListeners() {
    resizeEndAbortControllerRef.current?.abort();
    resizeEndAbortControllerRef.current = null;
  }

  function finishLeftPanelResize() {
    if (!resizingLeftPanelRef.current) {
      return;
    }

    resizingLeftPanelRef.current = false;
    setResizingLeftPanel(false);
    commitLeftPanelWidth(pendingLeftPanelRawWidthRef.current);
  }

  function finishChatPanelResize() {
    if (!resizingChatPanelRef.current) {
      return;
    }

    resizingChatPanelRef.current = false;
    setResizingChatPanel(false);
    commitChatPanelWidth(pendingChatPanelRawWidthRef.current);
  }

  function handleGlobalResizeEnd() {
    clearGlobalResizeEndListeners();
    finishLeftPanelResize();
    finishChatPanelResize();
  }

  function handleGlobalResizeMove(event: PointerEvent) {
    if (resizingLeftPanelRef.current) {
      event.preventDefault();
      previewLeftPanelWidthFromPointer(event.clientX);
    }

    if (resizingChatPanelRef.current) {
      event.preventDefault();
      previewChatPanelWidthFromPointer(event.clientX);
    }
  }

  function attachGlobalResizeEndListeners() {
    clearGlobalResizeEndListeners();

    const abortController = new AbortController();
    resizeEndAbortControllerRef.current = abortController;

    window.addEventListener("pointermove", handleGlobalResizeMove, {
      signal: abortController.signal,
    });
    window.addEventListener("pointerup", handleGlobalResizeEnd, {
      signal: abortController.signal,
    });
    window.addEventListener("pointercancel", handleGlobalResizeEnd, {
      signal: abortController.signal,
    });
    window.addEventListener("blur", handleGlobalResizeEnd, {
      signal: abortController.signal,
    });
  }

  function updateLeftPanelWidth(nextWidth: number) {
    commitLeftPanelWidth(nextWidth);
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizingLeftPanelRef.current = true;
    pendingLeftPanelRawWidthRef.current = visibleLeftPanelWidth;
    pendingLeftPanelWidthRef.current = visibleLeftPanelWidth;
    setResizingLeftPanel(true);
    attachGlobalResizeEndListeners();
    previewLeftPanelWidthFromPointer(event.clientX);
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizingLeftPanelRef.current) {
      return;
    }

    event.preventDefault();
    previewLeftPanelWidthFromPointer(event.clientX);
  }

  function handleResizePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    clearGlobalResizeEndListeners();
    finishLeftPanelResize();
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateLeftPanelWidth(visibleLeftPanelWidth - resizeStep);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      updateLeftPanelWidth(
        leftPanelCollapsed
          ? minExpandedLeftPanelWidth
          : visibleLeftPanelWidth + resizeStep,
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setWatchWidthVariable("--watch-left-panel-width", collapsedLeftPanelWidth);
      setLeftPanelCollapsed(true);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      leftPanelWidthRef.current = maxLeftPanelWidth;
      setWatchWidthVariable("--watch-left-panel-width", maxLeftPanelWidth);
      setLeftPanelCollapsed(false);
      setLeftPanelWidth(maxLeftPanelWidth);
    }
  }

  function getMaxChatPanelWidth() {
    const watchElement = watchRef.current;

    if (!watchElement) {
      return maxChatPanelFallbackWidth;
    }

    const style = window.getComputedStyle(watchElement);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const columnGap = Number.parseFloat(style.columnGap || style.gap) || 0;
    const availableWidth =
      watchElement.getBoundingClientRect().width -
      paddingLeft -
      paddingRight -
      visibleLeftPanelWidth -
      columnGap * 2;

    return Math.max(minExpandedChatPanelWidth, Math.floor(availableWidth));
  }

  function getMaxDraggableChatPanelWidth() {
    return Math.max(
      minExpandedChatPanelWidth,
      Math.floor(getMaxChatPanelWidth() / 2),
    );
  }

  function updateChatPanelWidth(nextWidth: number) {
    commitChatPanelWidth(nextWidth);
  }

  function getChatPanelWidthFromPointer(clientX: number) {
    const watchRect = watchRef.current?.getBoundingClientRect();

    if (!watchRect) {
      return null;
    }

    return watchRect.right - clientX - 8;
  }

  function previewChatPanelWidthFromPointer(clientX: number) {
    const nextWidth = getChatPanelWidthFromPointer(clientX);

    if (nextWidth === null) {
      return;
    }

    pendingChatPanelRawWidthRef.current = nextWidth;
    scheduleChatPanelWidthVariable(
      nextWidth < minExpandedChatPanelWidth
        ? collapsedChatPanelWidth
        : Math.min(nextWidth, getMaxDraggableChatPanelWidth()),
    );
  }

  function commitChatPanelWidth(nextWidth: number) {
    if (nextWidth < minExpandedChatPanelWidth) {
      pendingChatPanelWidthRef.current = collapsedChatPanelWidth;
      flushChatPanelWidthVariable();
      setChatPanelCollapsed(true);
      setChatPanelFullscreen(false);
      return;
    }

    const clampedWidth = Math.min(nextWidth, getMaxDraggableChatPanelWidth());
    chatPanelWidthRef.current = clampedWidth;
    pendingChatPanelWidthRef.current = clampedWidth;
    flushChatPanelWidthVariable();
    setChatPanelCollapsed(false);
    setChatPanelFullscreen(false);
    setChatPanelWidth(clampedWidth);
  }

  function handleChatResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizingChatPanelRef.current = true;
    pendingChatPanelRawWidthRef.current = visibleChatPanelWidth;
    pendingChatPanelWidthRef.current = visibleChatPanelWidth;
    setChatPanelFullscreen(false);
    setResizingChatPanel(true);
    attachGlobalResizeEndListeners();
    previewChatPanelWidthFromPointer(event.clientX);
  }

  function handleChatResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!resizingChatPanelRef.current) {
      return;
    }

    event.preventDefault();
    previewChatPanelWidthFromPointer(event.clientX);
  }

  function handleChatResizePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    finishChatPanelResize();
    clearGlobalResizeEndListeners();
  }

  function handleChatResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateChatPanelWidth(
        chatPanelCollapsed
          ? minExpandedChatPanelWidth
          : visibleChatPanelWidth + resizeStep,
      );
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      updateChatPanelWidth(visibleChatPanelWidth - resizeStep);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setWatchWidthVariable("--watch-chat-panel-width", collapsedChatPanelWidth);
      setChatPanelCollapsed(true);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const maxDraggableWidth = getMaxDraggableChatPanelWidth();
      chatPanelWidthRef.current = maxDraggableWidth;
      setWatchWidthVariable("--watch-chat-panel-width", maxDraggableWidth);
      setChatPanelCollapsed(false);
      setChatPanelFullscreen(false);
      setChatPanelWidth(maxDraggableWidth);
    }
  }

  function toggleLeftPanelCollapsed() {
    const nextCollapsed = !leftPanelCollapsed;

    setWatchWidthVariable(
      "--watch-left-panel-width",
      nextCollapsed ? collapsedLeftPanelWidth : leftPanelWidthRef.current,
    );
    setLeftPanelCollapsed(nextCollapsed);
  }

  function toggleChatPanelCollapsed() {
    const nextCollapsed = !chatPanelCollapsed;

    setWatchWidthVariable(
      "--watch-chat-panel-width",
      nextCollapsed ? collapsedChatPanelWidth : chatPanelWidthRef.current,
    );

    if (nextCollapsed) {
      setChatPanelFullscreen(false);
    }

    setChatPanelCollapsed(nextCollapsed);
  }

  function toggleChatPanelFullscreen() {
    setChatPanelCollapsed(false);

    if (chatPanelFullscreen) {
      const maxDraggableWidth = getMaxDraggableChatPanelWidth();

      chatPanelWidthRef.current = maxDraggableWidth;
      setWatchWidthVariable("--watch-chat-panel-width", maxDraggableWidth);
      setChatPanelFullscreen(false);
      setChatPanelWidth(maxDraggableWidth);
      return;
    }

    const maxChatPanelWidth = getMaxChatPanelWidth();

    chatPanelWidthRef.current = maxChatPanelWidth;
    setWatchWidthVariable("--watch-chat-panel-width", maxChatPanelWidth);
    setChatPanelFullscreen(true);
    setChatPanelWidth(maxChatPanelWidth);
  }

  function clampStreamChatOverlayPosition(position: StreamChatOverlayPosition) {
    const viewportBounds = streamViewportRef.current?.getBoundingClientRect();
    const overlayBounds = streamChatOverlayRef.current?.getBoundingClientRect();

    if (!viewportBounds) {
      return position;
    }

    const overlayWidth = overlayBounds?.width ?? 360;
    const overlayHeight = overlayBounds?.height ?? 480;
    const maxX = Math.max(streamChatOverlayInset, viewportBounds.width - overlayWidth - streamChatOverlayInset);
    const maxY = Math.max(streamChatOverlayInset, viewportBounds.height - overlayHeight - streamChatOverlayInset);

    return {
      x: Math.min(Math.max(position.x, streamChatOverlayInset), maxX),
      y: Math.min(Math.max(position.y, streamChatOverlayInset), maxY),
    };
  }

  function clearStreamChatOverlayDragListeners() {
    streamChatOverlayAbortControllerRef.current?.abort();
    streamChatOverlayAbortControllerRef.current = null;
  }

  function finishStreamChatOverlayDrag() {
    if (!streamChatOverlayDragRef.current) {
      return;
    }

    streamChatOverlayDragRef.current = null;
    clearStreamChatOverlayDragListeners();
    setStreamChatOverlayPosition((currentPosition) =>
      clampStreamChatOverlayPosition(currentPosition),
    );
  }

  function updateStreamChatOverlayDrag(clientX: number, clientY: number) {
    const drag = streamChatOverlayDragRef.current;

    if (!drag) {
      return;
    }

    setStreamChatOverlayPosition(
      clampStreamChatOverlayPosition({
        x: drag.initialX + clientX - drag.pointerX,
        y: drag.initialY + clientY - drag.pointerY,
      }),
    );
  }

  function handleStreamChatOverlayGlobalMove(event: PointerEvent) {
    if (!streamChatOverlayDragRef.current) {
      return;
    }

    event.preventDefault();
    updateStreamChatOverlayDrag(event.clientX, event.clientY);
  }

  function attachStreamChatOverlayDragListeners() {
    clearStreamChatOverlayDragListeners();

    const abortController = new AbortController();
    streamChatOverlayAbortControllerRef.current = abortController;

    window.addEventListener("pointermove", handleStreamChatOverlayGlobalMove, {
      signal: abortController.signal,
    });
    window.addEventListener("pointerup", finishStreamChatOverlayDrag, {
      signal: abortController.signal,
    });
    window.addEventListener("pointercancel", finishStreamChatOverlayDrag, {
      signal: abortController.signal,
    });
    window.addEventListener("blur", finishStreamChatOverlayDrag, {
      signal: abortController.signal,
    });
  }

  function handleStreamChatOverlayPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    streamChatOverlayDragRef.current = {
      initialX: streamChatOverlayPosition.x,
      initialY: streamChatOverlayPosition.y,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    attachStreamChatOverlayDragListeners();
  }

  function handleStreamChatOverlayPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!streamChatOverlayDragRef.current) {
      return;
    }

    event.preventDefault();
    updateStreamChatOverlayDrag(event.clientX, event.clientY);
  }

  function handleStreamChatOverlayPointerEnd(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    finishStreamChatOverlayDrag();
  }

  async function toggleStreamFullscreen() {
    const streamViewport = streamViewportRef.current;

    if (!streamViewport) {
      return;
    }

    try {
      if (document.fullscreenElement === streamViewport) {
        await document.exitFullscreen();
        return;
      }

      await streamViewport.requestFullscreen();
    } catch {
      setStreamFullscreen(false);
    }
  }

  function toggleChatPlatform(platform: Platform) {
    setVisibleChatPlatforms((currentPlatforms) =>
      currentPlatforms.includes(platform)
        ? currentPlatforms.filter((currentPlatform) => currentPlatform !== platform)
        : [...currentPlatforms, platform],
    );
  }

  return (
    <main
      ref={watchRef}
      aria-label="Market Bubble watch"
      className={`${styles.watch} ${leftPanelCollapsed ? styles.watchCollapsed : ""} ${
        chatPanelCollapsed ? styles.watchChatCollapsed : ""
      } ${chatPanelFullscreen ? styles.watchChatFullscreen : ""
      } ${resizingLeftPanel || resizingChatPanel ? styles.watchResizing : ""
      }`}
      style={watchStyle}
    >
      <aside className={styles.worldsPanel} aria-label="Worlds">
        <Link className={styles.homeButton} href="/" aria-label="Home">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            xmlns="http://www.w3.org/2000/svg"
            strokeWidth="0"
            className={styles.homeIcon}
            aria-hidden="true"
          >
            <path
              d="M20.83 8.01002L14.28 2.77002C13 1.75002 11 1.74002 9.72999 2.76002L3.17999 8.01002C2.23999 8.76002 1.66999 10.26 1.86999 11.44L3.12999 18.98C3.41999 20.67 4.98999 22 6.69999 22H17.3C18.99 22 20.59 20.64 20.88 18.97L22.14 11.43C22.32 10.26 21.75 8.76002 20.83 8.01002ZM12.75 18C12.75 18.41 12.41 18.75 12 18.75C11.59 18.75 11.25 18.41 11.25 18V15C11.25 14.59 11.59 14.25 12 14.25C12.41 14.25 12.75 14.59 12.75 15V18Z"
              fill="currentColor"
            />
          </svg>
        </Link>
        <button
          className={styles.panelToggleButton}
          type="button"
          aria-label={leftPanelCollapsed ? "Expand left panel" : "Collapse left panel"}
          aria-expanded={!leftPanelCollapsed}
          onClick={toggleLeftPanelCollapsed}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            xmlns="http://www.w3.org/2000/svg"
            strokeWidth="0"
            className={styles.panelToggleIcon}
            aria-hidden="true"
          >
            <path
              d="M2 7.81003V16.19C2 17.68 2.36 18.92 3.05 19.87C3.34 20.29 3.71 20.66 4.13 20.95C4.95 21.55 5.99 21.9 7.22 21.98V2.03003C3.94 2.24003 2 4.37003 2 7.81003Z"
              fill="currentColor"
            />
            <path
              d="M20.95 4.13C20.66 3.71 20.29 3.34 19.87 3.05C18.92 2.36 17.68 2 16.19 2H8.72V22H16.19C19.83 22 22 19.83 22 16.19V7.81C22 6.32 21.64 5.08 20.95 4.13ZM15.5 14.03C15.79 14.32 15.79 14.8 15.5 15.09C15.35 15.24 15.16 15.31 14.97 15.31C14.78 15.31 14.59 15.24 14.44 15.09L11.88 12.53C11.59 12.24 11.59 11.76 11.88 11.47L14.44 8.91C14.73 8.62 15.21 8.62 15.5 8.91C15.79 9.2 15.79 9.68 15.5 9.97L13.48 12L15.5 14.03Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <div
          className={styles.leftPanelContent}
          aria-hidden={leftPanelCollapsed ? "true" : undefined}
        >
          <div className={styles.leftPanelTabs} role="group" aria-label="Left panel feed">
            {leftPanelTabs.map((tab) => (
              <button
                data-active={tab.value === leftPanelTabValue ? "true" : undefined}
                type="button"
                key={tab.value}
                aria-pressed={tab.value === leftPanelTabValue}
                onClick={() => setLeftPanelTabValue(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={styles.leftPanelFeed}>
            {leftPanelTabValue === "news" ? (
              <div className={styles.leftPanelList} aria-label="Crypto and finance news">
                {watchNewswireError && watchNewsItems.length === 0 ? (
                  <p className={styles.leftPanelStatus}>{watchNewswireError}</p>
                ) : null}
                {!watchNewswire ? (
                  Array.from({ length: 7 }).map((_, index) => (
                    <div
                      className={`${styles.leftPanelCard} ${styles.leftPanelCardLoading}`}
                      key={index}
                    />
                  ))
                ) : null}
                {watchNewsItems.slice(0, 24).map((item) => {
                  const newsAvatarUrl = getNewswireAvatarUrl(item);

                  return (
                    <a
                      className={`${styles.leftPanelCard} ${styles.newsCard}`}
                      href={item.url}
                      key={item.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <header className={styles.newsCardHeader}>
                        <span className={styles.newsCardThumbnail}>
                          {newsAvatarUrl ? (
                            <img alt="" className={styles.newsCardAvatar} src={newsAvatarUrl} />
                          ) : (
                            <span className={styles.newsCardSourceIcon}>
                              {item.source.slice(0, 1)}
                            </span>
                          )}
                        </span>
                        <div className={styles.newsCardTitleGroup}>
                          <strong>{item.name}</strong>
                          <span>
                            {item.kind === "tweet" && item.handle
                              ? `@${item.handle}`
                              : item.source}
                          </span>
                        </div>
                        <time dateTime={new Date(item.ts).toISOString()}>
                          {formatFeedTime(item.ts)}
                        </time>
                      </header>
                      <div className={styles.newsCardBody}>
                        <p>{item.text}</p>
                      </div>
                      <footer className={styles.newsCardFooter}>
                        <span>{item.kind === "tweet" ? "X post" : "Article"}</span>
                        <span>{item.source}</span>
                      </footer>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className={styles.leftPanelList} aria-label="Live Polymarket markets">
                {watchPolymarketError && watchMarkets.length === 0 ? (
                  <p className={styles.leftPanelStatus}>{watchPolymarketError}</p>
                ) : null}
                {!watchPolymarket ? (
                  Array.from({ length: 7 }).map((_, index) => (
                    <div
                      className={`${styles.leftPanelCard} ${styles.leftPanelCardLoading}`}
                      key={index}
                    />
                  ))
                ) : null}
                {watchMarkets.slice(0, 18).map((market) => {
                  const yesValue = getMarketYesValue(market.probability);

                  return (
                    <a
                      className={`${styles.leftPanelCard} ${styles.marketCard}`}
                      data-category={market.primaryCategory}
                      href={market.url}
                      key={`${market.id}-${market.url}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <div className={styles.marketCardTitleGroup}>
                        <span>{`Closes ${formatMarketDate(market.closesAt)}`}</span>
                        <strong>{market.question}</strong>
                      </div>
                      <div className={styles.marketCardChart}>
                        {yesValue === null ? (
                          <div className={styles.marketCardNoOdds}>Live market</div>
                        ) : (
                          <PercentageBarChart
                            barMinSize={8}
                            borderRadius={24}
                            height={8}
                            legendFormat="label-value"
                            series={[
                              {
                                id: "yes",
                                data: yesValue,
                                label: "Yes",
                                color: sentimentSeriesColors.bullish,
                                legendShape: "circle",
                              },
                              {
                                id: "no",
                                data: 100 - yesValue,
                                label: "No",
                                color: sentimentSeriesColors.bearish,
                                legendShape: "square",
                              },
                            ]}
                            stackGap={4}
                          />
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div
          className={styles.leftPanelResizeHandle}
          role="separator"
          aria-label="Resize left panel"
          aria-orientation="vertical"
          aria-valuemin={collapsedLeftPanelWidth}
          aria-valuemax={maxLeftPanelWidth}
          aria-valuenow={visibleLeftPanelWidth}
          tabIndex={0}
          onKeyDown={handleResizeKeyDown}
          onLostPointerCapture={handleResizePointerEnd}
          onPointerCancel={handleResizePointerEnd}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerEnd}
        />
      </aside>
      <section className={styles.practicePanel} aria-label="Stream">
        <div
          className={styles.streamViewport}
          data-fullscreen={streamFullscreen ? "true" : undefined}
          ref={streamViewportRef}
        >
          <iframe
            className={styles.streamPlayer}
            src={twitchVideoSrc}
            title="Market Bubble stream"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
          <button
            className={styles.streamFullscreenButton}
            type="button"
            aria-label={streamFullscreen ? "Exit stream fullscreen" : "Stream fullscreen"}
            aria-pressed={streamFullscreen}
            onClick={() => void toggleStreamFullscreen()}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              strokeWidth="0.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              className={styles.streamFullscreenIcon}
              aria-hidden="true"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect width="10" height="8" x="7" y="8" rx="1" />
            </svg>
          </button>
          {streamFullscreen && streamChatOverlayEnabled ? (
            <div
              className={styles.streamChatOverlay}
              ref={streamChatOverlayRef}
              style={streamChatOverlayStyle}
              aria-label="Stream chat overlay"
            >
              <header className={styles.streamChatOverlayHeader}>
                <div
                  className={styles.streamChatOverlayDragHandle}
                  aria-label="Move stream chat overlay"
                  onLostPointerCapture={handleStreamChatOverlayPointerEnd}
                  onPointerCancel={handleStreamChatOverlayPointerEnd}
                  onPointerDown={handleStreamChatOverlayPointerDown}
                  onPointerMove={handleStreamChatOverlayPointerMove}
                  onPointerUp={handleStreamChatOverlayPointerEnd}
                >
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.streamChatOverlayPlatforms} aria-hidden="true">
                  <SiX />
                  <SiTwitch />
                  <SiKick />
                </div>
                <button
                  className={styles.streamChatOverlayButton}
                  type="button"
                  aria-label="Disable stream chat overlay"
                  onClick={() => setStreamChatOverlayEnabled(false)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={styles.streamChatOverlayButtonIcon}
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </header>
              <AggregatedChat
                channelOptions={watchChannelOptions}
                enableDirectChatSockets={false}
                enablePopout={false}
                enableTickerCards={false}
                liveEventsPollMs={12_000}
                maxMessagesPerPlatform={80}
                messageRenderLimit={80}
                mode="embedded"
                monitoredSources={watchSources}
                onChannelChange={ignoreChannelChange}
                selectedChannelValue={watchChannelValue}
                showStats={false}
                useMockData={false}
                visiblePlatforms={visibleChatPlatforms}
              />
            </div>
          ) : null}
          {streamFullscreen && !streamChatOverlayEnabled ? (
            <button
              className={styles.streamChatOverlayRestoreButton}
              type="button"
              aria-label="Enable stream chat overlay"
              onClick={() => {
                setStreamChatOverlayPosition((currentPosition) =>
                  clampStreamChatOverlayPosition(currentPosition),
                );
                setStreamChatOverlayEnabled(true);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
                xmlns="http://www.w3.org/2000/svg"
                strokeWidth="0"
                className={styles.streamChatOverlayRestoreIcon}
                aria-hidden="true"
              >
                <path
                  d="M17.53 7.77C17.46 7.76 17.39 7.76 17.32 7.77C15.77 7.72 14.54 6.45 14.54 4.89C14.54 3.3 15.83 2 17.43 2C19.02 2 20.32 3.29 20.32 4.89C20.31 6.45 19.08 7.72 17.53 7.77Z"
                  fill="currentColor"
                />
                <path
                  d="M20.7901 14.6999C19.6701 15.4499 18.1001 15.7299 16.6501 15.5399C17.0301 14.7199 17.2301 13.8099 17.2401 12.8499C17.2401 11.8499 17.0201 10.8999 16.6001 10.0699C18.0801 9.86991 19.6501 10.1499 20.7801 10.8999C22.3601 11.9399 22.3601 13.6499 20.7901 14.6999Z"
                  fill="currentColor"
                />
                <path
                  d="M6.43991 7.77C6.50991 7.76 6.57991 7.76 6.64991 7.77C8.19991 7.72 9.42991 6.45 9.42991 4.89C9.42991 3.29 8.13991 2 6.53991 2C4.94991 2 3.65991 3.29 3.65991 4.89C3.65991 6.45 4.88991 7.72 6.43991 7.77Z"
                  fill="currentColor"
                />
                <path
                  d="M6.55012 12.8501C6.55012 13.8201 6.76012 14.7401 7.14012 15.5701C5.73012 15.7201 4.26012 15.4201 3.18012 14.7101C1.60012 13.6601 1.60012 11.9501 3.18012 10.9001C4.25012 10.1801 5.76012 9.8901 7.18012 10.0501C6.77012 10.8901 6.55012 11.8401 6.55012 12.8501Z"
                  fill="currentColor"
                />
                <path
                  d="M12.12 15.87C12.04 15.86 11.95 15.86 11.86 15.87C10.02 15.81 8.55005 14.3 8.55005 12.44C8.56005 10.54 10.09 9 12 9C13.9 9 15.44 10.54 15.44 12.44C15.43 14.3 13.97 15.81 12.12 15.87Z"
                  fill="currentColor"
                />
                <path
                  d="M8.87005 17.9401C7.36005 18.9501 7.36005 20.6101 8.87005 21.6101C10.59 22.7601 13.41 22.7601 15.13 21.6101C16.64 20.6001 16.64 18.9401 15.13 17.9401C13.42 16.7901 10.6 16.7901 8.87005 17.9401Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          ) : null}
        </div>
        <section
          className={styles.streamStatsPanel}
          data-collapsed={streamStatsCollapsed ? "true" : undefined}
          aria-label="Stream stats"
        >
          <button
            className={styles.streamStatsCollapseButton}
            type="button"
            aria-label={streamStatsCollapsed ? "Expand stream stats" : "Collapse stream stats"}
            aria-expanded={!streamStatsCollapsed}
            onClick={() => setStreamStatsCollapsed((isCollapsed) => !isCollapsed)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.streamStatsCollapseIcon}
              aria-hidden="true"
            >
              <path d="m7 10 5 5 5-5" />
              <path d="m7 5 5 5 5-5" />
            </svg>
          </button>
          <div
            className={styles.streamStatsLeft}
            aria-hidden={streamStatsCollapsed ? "true" : undefined}
          >
            <div
              className={styles.streamStatsToggle}
              role="group"
              aria-label="Stats source"
              style={statsSwitcherStyle}
            >
              {watchStatsSourceOptions.map((sourceOption) => (
                <button
                  data-active={
                    sourceOption.value === selectedStatsSourceValue ? "true" : undefined
                  }
                  type="button"
                  key={sourceOption.value}
                  aria-pressed={sourceOption.value === selectedStatsSourceValue}
                  disabled={streamStatsCollapsed}
                  onClick={() => setSelectedStatsSourceValue(sourceOption.value)}
                >
                  {sourceOption.label}
                </button>
              ))}
            </div>
            <div className={styles.streamStatsContent}>
              <dl className={styles.streamStatsSummary}>
                <div>
                  <dt>Total viewers</dt>
                  <dd>
                    <AnimatedNumber value={watchStats.totalViewers} />
                  </dd>
                </div>
                <div>
                  <dt>Active chatters</dt>
                  <dd>
                    <AnimatedNumber value={watchStats.activeChatters} />
                  </dd>
                </div>
                <div>
                  <dt>Messages / min</dt>
                  <dd>
                    <AnimatedNumber value={watchStats.messagesPerMinute} />
                  </dd>
                </div>
              </dl>
              <div className={styles.streamStatsPlatforms} aria-label="Viewers by platform">
                {watchPlatforms.map((platform) => {
                  const platformCount = watchStats.platformViewers[platform];
                  const platformShare =
                    watchStats.totalViewers === 0
                      ? 0
                      : Math.round((platformCount / watchStats.totalViewers) * 100);

                  return (
                    <div className={styles.streamStatsPlatformRow} key={platform}>
                      <div className={styles.streamStatsPlatformLabel}>
                        <span
                          className={`${styles.streamStatsPlatformLogo} ${
                            styles[`streamStatsPlatformLogo${platform}`]
                          }`}
                        >
                          <PlatformLogo platform={platform} />
                        </span>
                        <span>{platform}</span>
                      </div>
                      <div className={styles.streamStatsPlatformValue}>
                        <AnimatedNumber
                          className={styles.streamStatsPlatformCount}
                          value={platformCount}
                        />
                        <AnimatedNumber
                          className={styles.streamStatsPlatformShare}
                          suffix="%"
                          value={platformShare}
                        />
                      </div>
                      <div
                        className={`${styles.streamStatsPlatformBar} ${
                          styles[`streamStatsPlatformBar${platform}`]
                        }`}
                        style={{ "--platform-share": `${platformShare}%` } as CSSProperties}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
            <div
              className={styles.streamSentimentPanel}
              data-tone={sentimentSummary.tone}
              aria-hidden={streamStatsCollapsed ? "true" : undefined}
            >
              <div className={styles.streamTrendCards} aria-label="Top chat words">
                {Array.from({ length: 3 }, (_, index) => {
                  const trendTerm = watchTrendingTerms[index];

                  return (
                    <div
                      className={styles.streamTrendCard}
                      data-empty={trendTerm ? undefined : "true"}
                      key={trendTerm?.id ?? `empty-${index}`}
                      style={
                        {
                          "--trend-share": `${trendTerm?.share ?? 0}%`,
                        } as CSSProperties
                      }
                    >
                      <span>{`0${index + 1}`}</span>
                      <strong>{trendTerm?.label ?? "Listening"}</strong>
                      <small>
                        {trendTerm
                          ? `${trendTerm.count} ${trendTerm.count === 1 ? "message" : "messages"}`
                          : "No signal yet"}
                      </small>
                    </div>
                  );
                })}
              </div>
              <div className={styles.streamSentimentHeader}>
                <span>Bearish / Bullish</span>
                <strong>{sentimentSummary.label}</strong>
              </div>
              <PercentageBarChart
                barMinSize={8}
                borderRadius={24}
                height={8}
                series={[
                  {
                    id: "bearish",
                    data: sentimentSummary.bearShare,
                    label: "Bearish",
                    color: sentimentSeriesColors.bearish,
                    legendShape: "square",
                  },
                  {
                    id: "bullish",
                    data: sentimentSummary.bullShare,
                    label: "Bullish",
                    color: sentimentSeriesColors.bullish,
                    legendShape: "circle",
                  },
                ]}
                stackGap={4}
              />
            </div>
        </section>
      </section>
      <aside className={styles.chatPanel} aria-label="Aggregated live stream chat">
        <div
          className={styles.chatPanelResizeHandle}
          role="separator"
          aria-label="Resize chat panel"
          aria-orientation="vertical"
          aria-valuemin={collapsedChatPanelWidth}
          aria-valuemax={maxChatPanelFallbackWidth}
          aria-valuenow={visibleChatPanelWidth}
          tabIndex={0}
          onKeyDown={handleChatResizeKeyDown}
          onLostPointerCapture={handleChatResizePointerEnd}
          onPointerCancel={handleChatResizePointerEnd}
          onPointerDown={handleChatResizePointerDown}
          onPointerMove={handleChatResizePointerMove}
          onPointerUp={handleChatResizePointerEnd}
        />
        <div className={styles.liveChat}>
          <header className={styles.liveChatHeader}>
            <div className={styles.chatHeaderActions}>
              <button
                className={styles.chatCollapseButton}
                type="button"
                aria-label={chatPanelCollapsed ? "Expand chat panel" : "Collapse chat panel"}
                aria-expanded={!chatPanelCollapsed}
                onClick={toggleChatPanelCollapsed}
              >
                {chatPanelCollapsed ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                    xmlns="http://www.w3.org/2000/svg"
                    strokeWidth="0"
                    className={styles.chatCollapseIcon}
                    aria-hidden="true"
                  >
                    <path
                      d="M22 8.34007V15.6601C22 17.1601 20.37 18.1001 19.07 17.3501L15.9 15.5201L12.73 13.6901L12.24 13.4101V10.5901L12.73 10.3101L15.9 8.48007L19.07 6.65007C20.37 5.90007 22 6.84007 22 8.34007Z"
                      fill="currentColor"
                    />
                    <path
                      d="M12.2399 8.34007V15.6601C12.2399 17.1601 10.6099 18.1001 9.31994 17.3501L6.13994 15.5201L2.96994 13.6901C1.67994 12.9401 1.67994 11.0601 2.96994 10.3101L6.13994 8.48007L9.31994 6.65007C10.6099 5.90007 12.2399 6.84007 12.2399 8.34007Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                    xmlns="http://www.w3.org/2000/svg"
                    strokeWidth="0"
                    className={styles.chatCollapseIcon}
                    aria-hidden="true"
                  >
                    <path
                      d="M2 8.34007V15.6601C2 17.1601 3.63 18.1001 4.93 17.3501L8.1 15.5201L11.27 13.6901L11.76 13.4101V10.5901L11.27 10.3101L8.1 8.48007L4.93 6.65007C3.63 5.90007 2 6.84007 2 8.34007Z"
                      fill="currentColor"
                    />
                    <path
                      d="M11.76 8.34007V15.6601C11.76 17.1601 13.39 18.1001 14.68 17.3501L17.86 15.5201L21.03 13.6901C22.32 12.9401 22.32 11.0601 21.03 10.3101L17.86 8.48007L14.68 6.65007C13.39 5.90007 11.76 6.84007 11.76 8.34007Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
              <button
                className={styles.chatFullscreenButton}
                type="button"
                aria-label={
                  chatPanelFullscreen ? "Exit full screen chat panel" : "Full screen chat panel"
                }
                aria-pressed={chatPanelFullscreen}
                onClick={toggleChatPanelFullscreen}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  strokeWidth="0.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className={styles.chatFullscreenIcon}
                  aria-hidden="true"
                >
                  <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <rect width="10" height="8" x="7" y="8" rx="1" />
                </svg>
              </button>
            </div>
            <div className={styles.liveChatPlatforms} aria-label="Aggregated platforms">
              <button
                className={styles.platformPill}
                data-active={visibleChatPlatforms.includes("X") ? "true" : undefined}
                data-platform="x"
                type="button"
                aria-label="Toggle X chat"
                aria-pressed={visibleChatPlatforms.includes("X")}
                onClick={() => toggleChatPlatform("X")}
              >
                <SiX aria-hidden="true" />
              </button>
              <button
                className={styles.platformPill}
                data-active={visibleChatPlatforms.includes("Twitch") ? "true" : undefined}
                data-platform="twitch"
                type="button"
                aria-label="Toggle Twitch chat"
                aria-pressed={visibleChatPlatforms.includes("Twitch")}
                onClick={() => toggleChatPlatform("Twitch")}
              >
                <SiTwitch aria-hidden="true" />
              </button>
              <button
                className={styles.platformPill}
                data-active={visibleChatPlatforms.includes("Kick") ? "true" : undefined}
                data-platform="kick"
                type="button"
                aria-label="Toggle Kick chat"
                aria-pressed={visibleChatPlatforms.includes("Kick")}
                onClick={() => toggleChatPlatform("Kick")}
              >
                <SiKick aria-hidden="true" />
              </button>
            </div>
          </header>
          <AggregatedChat
            channelOptions={watchChannelOptions}
            enablePopout={false}
            liveEventsPollMs={12_000}
            maxMessagesPerPlatform={180}
            messageRenderLimit={160}
            mode="embedded"
            monitoredSources={watchSources}
            onChannelChange={ignoreChannelChange}
            searchQuery={chatSearchQuery}
            selectedChannelValue={watchChannelValue}
            showStats={false}
            useMockData={false}
            visiblePlatforms={visibleChatPlatforms}
            viewMode={chatViewMode}
          />
          <div className={styles.chatSearchBar}>
            <button
              className={styles.chatSearchIconButton}
              data-active={chatViewMode === "chatters" ? "true" : undefined}
              type="button"
              aria-label={chatViewMode === "chatters" ? "Show chat messages" : "Show top chatters"}
              aria-pressed={chatViewMode === "chatters"}
              onClick={() =>
                setChatViewMode((currentMode) =>
                  currentMode === "chatters" ? "messages" : "chatters",
                )
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
                xmlns="http://www.w3.org/2000/svg"
                strokeWidth="0"
                className={styles.chatSearchIcon}
                aria-hidden="true"
              >
                <path
                  d="M17.53 7.77C17.46 7.76 17.39 7.76 17.32 7.77C15.77 7.72 14.54 6.45 14.54 4.89C14.54 3.3 15.83 2 17.43 2C19.02 2 20.32 3.29 20.32 4.89C20.31 6.45 19.08 7.72 17.53 7.77Z"
                  fill="currentColor"
                />
                <path
                  d="M20.7901 14.6999C19.6701 15.4499 18.1001 15.7299 16.6501 15.5399C17.0301 14.7199 17.2301 13.8099 17.2401 12.8499C17.2401 11.8499 17.0201 10.8999 16.6001 10.0699C18.0801 9.86991 19.6501 10.1499 20.7801 10.8999C22.3601 11.9399 22.3601 13.6499 20.7901 14.6999Z"
                  fill="currentColor"
                />
                <path
                  d="M6.43991 7.77C6.50991 7.76 6.57991 7.76 6.64991 7.77C8.19991 7.72 9.42991 6.45 9.42991 4.89C9.42991 3.29 8.13991 2 6.53991 2C4.94991 2 3.65991 3.29 3.65991 4.89C3.65991 6.45 4.88991 7.72 6.43991 7.77Z"
                  fill="currentColor"
                />
                <path
                  d="M6.55012 12.8501C6.55012 13.8201 6.76012 14.7401 7.14012 15.5701C5.73012 15.7201 4.26012 15.4201 3.18012 14.7101C1.60012 13.6601 1.60012 11.9501 3.18012 10.9001C4.25012 10.1801 5.76012 9.8901 7.18012 10.0501C6.77012 10.8901 6.55012 11.8401 6.55012 12.8501Z"
                  fill="currentColor"
                />
                <path
                  d="M12.12 15.87C12.04 15.86 11.95 15.86 11.86 15.87C10.02 15.81 8.55005 14.3 8.55005 12.44C8.56005 10.54 10.09 9 12 9C13.9 9 15.44 10.54 15.44 12.44C15.43 14.3 13.97 15.81 12.12 15.87Z"
                  fill="currentColor"
                />
                <path
                  d="M8.87005 17.9401C7.36005 18.9501 7.36005 20.6101 8.87005 21.6101C10.59 22.7601 13.41 22.7601 15.13 21.6101C16.64 20.6001 16.64 18.9401 15.13 17.9401C13.42 16.7901 10.6 16.7901 8.87005 17.9401Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <input
              type="search"
              aria-label="Search chat users or messages"
              placeholder="Search users or messages"
              value={chatSearchQuery}
              onChange={(event) => setChatSearchQuery(event.target.value)}
            />
          </div>
        </div>
      </aside>
    </main>
  );
}
