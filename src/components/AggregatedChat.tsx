"use client";

import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiCheckCircle,
  FiExternalLink,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
import { SiKick, SiTwitch, SiX } from "react-icons/si";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type {
  CommunityChatEvent,
  CommunityLiveEventsResponse,
} from "@/lib/community-top-chat-types";
import {
  getAuthorColor,
  kickPusherUrl,
  legacyClientChatSocketsEnabled,
  parseIrcTags,
  stripChatHtml,
} from "@/lib/live-chat-aggregator";

const defaultMaxMessagesPerPlatform = 100;
const activeWindowMs = 5 * 60 * 1000;
const rateWindowMs = 60 * 1000;
const statsIntroDelayMs = 4320;
const platforms: Platform[] = ["Twitch", "Kick", "X"];
const platformLogoColors: Record<Platform, string> = {
  Kick: "#53fc18",
  Twitch: "#9146ff",
  X: "#e4e4e4",
};
type ChatMessage = {
  id: string;
  platform: Platform;
  author: string;
  authorColor?: string;
  channel?: string;
  emotes?: ChatEmote[];
  bits?: number;
  eventLabel?: string;
  eventType?: "bits" | "first-message" | "raid" | "sub" | "subgift" | "system";
  firstMessage?: boolean;
  receivedAt?: number;
  text: string;
  time: string;
};

export type Platform = "Twitch" | "Kick" | "X";

type ChatEmote = {
  end: number;
  id: string;
  name: string;
  provider: "7tv" | "bttv" | "ffz" | "tw";
  start: number;
};

type ThirdPartyChatEmote = {
  id: string;
  name: string;
  provider: "7tv" | "bttv" | "ffz";
  url: string;
};

type TickerHoverAsset = {
  asset: {
    description: string;
    imageUrl?: string;
    name: string;
    ticker: string;
  };
  changePercent: number | null;
  chart: Array<{
    close: number;
    time: string;
  }>;
  currency: string;
  fetchedAt: string;
  price: number | null;
  sources: string[];
};

const tickerHoverCache = new Map<string, Promise<TickerHoverAsset>>();
const tickerImageFallbacks: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
};

export type KickChannelSource = {
  channel: string;
  chatroomId: number;
};

export type SourceSet = {
  kickChannels: KickChannelSource[];
  twitchChannels: string[];
  xHandles: string[];
};

export type ChannelOption = SourceSet & {
  label: string;
  value: string;
};

type ChatStats = {
  activeChatters: Record<string, number>;
  messageTimes: number[];
  platformCounts: Record<Platform, number>;
  totalMessages: number;
};

type StreamMetrics = {
  kickViewers: number;
  totalViewers: number;
  twitchViewers: number;
  xViewers: number;
};

type MockChatStats = {
  activeChatters: number;
  messagesPerMinute: number;
  platformCounts: Record<Platform, number>;
};

type XProfile = {
  avatarUrl?: string;
  description: string;
  followers: number;
  following: number;
  handle: string;
  name: string;
  profileUrl: string;
  verified: boolean;
};

const defaultMockStreamMetrics: StreamMetrics = {
  kickViewers: 18340,
  totalViewers: 29540,
  twitchViewers: 0,
  xViewers: 11200,
};

const emptyStreamMetrics: StreamMetrics = {
  kickViewers: 0,
  totalViewers: 0,
  twitchViewers: 0,
  xViewers: 0,
};

const defaultMockChatStats: MockChatStats = {
  activeChatters: 1620,
  messagesPerMinute: 520,
  platformCounts: {
    Kick: 52600,
    Twitch: 1180,
    X: 18000,
  },
};

const emptyMockChatStats: MockChatStats = {
  activeChatters: 0,
  messagesPerMinute: 0,
  platformCounts: {
    Kick: 0,
    Twitch: 0,
    X: 0,
  },
};

const mockChatStatsByChannel: Record<string, MockChatStats> = {
  ansem: {
    activeChatters: 1620,
    messagesPerMinute: 520,
    platformCounts: {
      Kick: 52600,
      Twitch: 1180,
      X: 18000,
    },
  },
  banks: {
    activeChatters: 2240,
    messagesPerMinute: 690,
    platformCounts: {
      Kick: 2100,
      Twitch: 58400,
      X: 22000,
    },
  },
  both: {
    activeChatters: 3860,
    messagesPerMinute: 1180,
    platformCounts: {
      Kick: 52600,
      Twitch: 58400,
      X: 40000,
    },
  },
};

const mockStreamMetricsByChannel: Record<string, StreamMetrics> = {
  ansem: {
    kickViewers: 18340,
    totalViewers: 29540,
    twitchViewers: 0,
    xViewers: 11200,
  },
  banks: {
    kickViewers: 0,
    totalViewers: 40070,
    twitchViewers: 26870,
    xViewers: 13200,
  },
  both: {
    kickViewers: 18340,
    totalViewers: 69610,
    twitchViewers: 26870,
    xViewers: 24400,
  },
};

const mockChatMessages: ChatMessage[] = [
  {
    id: "mock-kick-1",
    platform: "Kick",
    author: "chainwatcher",
    authorColor: "#53fc18",
    text: "ansem stream waiting room is still undefeated",
    time: "4:03 PM",
  },
  {
    id: "mock-x-1",
    platform: "X",
    author: "macrodesk",
    text: "banks just posted the marketbubble clip again",
    time: "4:03 PM",
  },
  {
    id: "mock-twitch-1",
    platform: "Twitch",
    author: "liquiditytrap",
    text: "fazebanks chat about to be chaos when he goes live",
    time: "4:04 PM",
  },
  {
    id: "mock-kick-2",
    platform: "Kick",
    author: "solana_sam",
    authorColor: "#45d483",
    text: "need ansem to talk through this btc candle",
    time: "4:04 PM",
  },
  {
    id: "mock-x-2",
    platform: "X",
    author: "volatilitydesk",
    text: "ai names ripping while everyone is watching crypto",
    time: "4:04 PM",
  },
  {
    id: "mock-twitch-2",
    platform: "Twitch",
    author: "bankrollben",
    text: "chat is gonna ask about the faZe treasury immediately",
    time: "4:05 PM",
  },
  {
    id: "mock-kick-3",
    platform: "Kick",
    author: "perpmaxi",
    authorColor: "#ffb347",
    text: "if hype breaks out this whole room wakes up",
    time: "4:05 PM",
  },
  {
    id: "mock-x-3",
    platform: "X",
    author: "blkterminal",
    text: "the audience wants trades, drama, and receipts",
    time: "4:05 PM",
  },
  {
    id: "mock-twitch-3",
    platform: "Twitch",
    author: "marketsleeper",
    text: "vod on while we wait is the right call",
    time: "4:06 PM",
  },
  {
    id: "mock-kick-4",
    platform: "Kick",
    author: "etherhours",
    authorColor: "#72e0d1",
    text: "eth looks boring until it moves 7% in one candle",
    time: "4:06 PM",
  },
  {
    id: "mock-x-4",
    platform: "X",
    author: "tickerstorm",
    text: "market bubble needs a live odds board next",
    time: "4:06 PM",
  },
  {
    id: "mock-twitch-4",
    platform: "Twitch",
    author: "positionbuilder",
    text: "banks x ansem episode would send this",
    time: "4:07 PM",
  },
  {
    id: "mock-kick-5",
    platform: "Kick",
    author: "walletwatcher",
    authorColor: "#c7e85f",
    text: "someone ask about the sol unlocks first",
    time: "4:07 PM",
  },
  {
    id: "mock-x-5",
    platform: "X",
    author: "attentiondesk",
    text: "every clip from this setup is going to look expensive",
    time: "4:08 PM",
  },
  {
    id: "mock-twitch-5",
    platform: "Twitch",
    author: "clipfarmer",
    text: "chat moving faster than the tape already",
    time: "4:08 PM",
  },
  {
    id: "mock-kick-6",
    platform: "Kick",
    author: "perpdriver",
    authorColor: "#ff7a9a",
    text: "need live odds for every take they make",
    time: "4:08 PM",
  },
  {
    id: "mock-x-6",
    platform: "X",
    author: "marketmaker",
    text: "banks has the distribution, ansem has the trade flow",
    time: "4:09 PM",
  },
  {
    id: "mock-twitch-6",
    platform: "Twitch",
    author: "greenwick",
    text: "this is the exact chaos dashboard i wanted",
    time: "4:09 PM",
  },
  {
    id: "mock-kick-7",
    platform: "Kick",
    author: "basismax",
    authorColor: "#4fa7ff",
    text: "hype mention count should be a stat too",
    time: "4:09 PM",
  },
  {
    id: "mock-x-7",
    platform: "X",
    author: "alphathread",
    text: "quote tweets are going to be the third chat",
    time: "4:10 PM",
  },
  {
    id: "mock-twitch-7",
    platform: "Twitch",
    author: "tabcollector",
    text: "stage looks clean with the vod in the middle",
    time: "4:10 PM",
  },
  {
    id: "mock-kick-8",
    platform: "Kick",
    author: "onchainmike",
    authorColor: "#d889ff",
    text: "if btc tags highs this chat explodes",
    time: "4:10 PM",
  },
  {
    id: "mock-x-8",
    platform: "X",
    author: "tickerreply",
    text: "need a live sentiment meter next to the stream",
    time: "4:11 PM",
  },
  {
    id: "mock-twitch-8",
    platform: "Twitch",
    author: "watchparty",
    text: "banks offline but the room still feels live",
    time: "4:11 PM",
  },
];

const mockRecordedAt = Number.MAX_SAFE_INTEGER - activeWindowMs;
const mockStreamTemplates: Array<Omit<ChatMessage, "id" | "time">> = [
  {
    platform: "Kick",
    author: "chartlurker",
    authorColor: "#53fc18",
    text: "waiting on ansem but the room is already cooking",
  },
  {
    platform: "X",
    author: "macrofeed",
    text: "banks timeline is all marketbubble replies right now",
  },
  {
    platform: "Twitch",
    author: "riskonron",
    text: "fazebanks chat will spam the same question 500 times",
  },
  {
    platform: "Kick",
    author: "spotbidder",
    authorColor: "#ffb347",
    text: "btc needs one more clean push",
  },
  {
    platform: "X",
    author: "openinterest",
    text: "ai and crypto on the same show is smart",
  },
  {
    platform: "Twitch",
    author: "candlemaker",
    text: "vod is keeping the stage alive while everyone is offline",
  },
  {
    platform: "Kick",
    author: "hyperliquidated",
    authorColor: "#72e0d1",
    text: "hype chat would be pure noise if this breaks higher",
  },
  {
    platform: "X",
    author: "tradewarroom",
    text: "need the guest to explain the actual thesis",
  },
  {
    platform: "Twitch",
    author: "greenbutton",
    text: "this layout feels like a live terminal for drama",
  },
  {
    platform: "Kick",
    author: "solwatch",
    authorColor: "#45d483",
    text: "sol holders waiting for one sentence from ansem",
  },
  {
    platform: "X",
    author: "attentionmarket",
    text: "command attention is the whole product",
  },
  {
    platform: "Twitch",
    author: "deskpop",
    text: "banks needs to bring this exact energy live",
  },
  {
    platform: "Kick",
    author: "bidwall",
    authorColor: "#a970ff",
    text: "orderbook watching is more fun with chat yelling",
  },
  {
    platform: "X",
    author: "timelinealpha",
    text: "everyone is posting the same chart with different confidence",
  },
  {
    platform: "Twitch",
    author: "modqueue",
    text: "mods will need a war room when this goes live",
  },
  {
    platform: "Kick",
    author: "deltaheavy",
    authorColor: "#ff6f61",
    text: "one bank headline and this chat becomes unusable",
  },
  {
    platform: "X",
    author: "signalrunner",
    text: "this is basically market sentiment in one screen",
  },
  {
    platform: "Twitch",
    author: "replaycrew",
    text: "vod playback is fine but live will hit different",
  },
  {
    platform: "Kick",
    author: "leverage_larry",
    authorColor: "#f0d35f",
    text: "risk management arc when",
  },
  {
    platform: "X",
    author: "bubblewatch",
    text: "market bubble should track who moves the room",
  },
  {
    platform: "Twitch",
    author: "screencapper",
    text: "clip this layout before they change it",
  },
  {
    platform: "Kick",
    author: "gaswar",
    authorColor: "#7aa7ff",
    text: "eth gas quiet is usually the warning sign",
  },
  {
    platform: "X",
    author: "crowdindex",
    text: "chat velocity as a signal is underrated",
  },
  {
    platform: "Twitch",
    author: "whalealerted",
    text: "someone is going to ask for bags in the first minute",
  },
];

const mockPlatformSequences: Record<string, Platform[]> = {
  ansem: [
    "Kick",
    "Kick",
    "Kick",
    "Kick",
    "Kick",
    "X",
    "Kick",
    "Kick",
    "Kick",
    "Twitch",
  ],
  banks: [
    "Twitch",
    "Twitch",
    "Twitch",
    "Twitch",
    "Twitch",
    "X",
    "Twitch",
    "Twitch",
    "Kick",
    "Twitch",
  ],
  both: [
    "Kick",
    "Twitch",
    "Kick",
    "Twitch",
    "X",
    "Kick",
    "Twitch",
    "Kick",
    "Twitch",
    "X",
  ],
};

function createPlatformCounts(): Record<Platform, number> {
  return {
    Twitch: 0,
    Kick: 0,
    X: 0,
  };
}

function getMockStreamMetrics(channelValue: string) {
  return mockStreamMetricsByChannel[channelValue] ?? defaultMockStreamMetrics;
}

function getMockChatStats(channelValue: string) {
  return mockChatStatsByChannel[channelValue] ?? defaultMockChatStats;
}

function createInitialChatStats(messages: ChatMessage[]): ChatStats {
  const activeChatters: Record<string, number> = {};
  const platformCounts = createPlatformCounts();

  for (const message of messages) {
    activeChatters[`${message.platform}:${message.author.toLowerCase()}`] =
      mockRecordedAt;
    platformCounts[message.platform] += 1;
  }

  return {
    activeChatters,
    messageTimes: messages.map(() => mockRecordedAt),
    platformCounts,
    totalMessages: messages.length,
  };
}

function parseTwitchEmotes(value: string | undefined, text: string): ChatEmote[] {
  if (!value) {
    return [];
  }

  return value
    .split("/")
    .flatMap((entry) => {
      const [id = "", ranges = ""] = entry.split(":");

      if (!id || !ranges) {
        return [];
      }

      return ranges
        .split(",")
        .flatMap((range) => {
          const [startValue = "", endValue = ""] = range.split("-");
          const start = Number.parseInt(startValue, 10);
          const end = Number.parseInt(endValue, 10);

          if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
            return [];
          }

          return [{
            end,
            id,
            name: text.slice(start, end + 1),
            provider: "tw" as const,
            start,
          }];
        });
    })
    .toSorted((first, second) => first.start - second.start);
}

function decodeIrcTagValue(value: string | undefined) {
  return (value ?? "")
    .replace(/\\s/g, " ")
    .replace(/\\:/g, ";")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");
}

function parsePositiveNumber(value: string | undefined) {
  const parsedValue = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}

function getTwitchUserNoticeLabel(tags: Record<string, string>) {
  const messageId = tags["msg-id"];

  switch (messageId) {
    case "sub":
      return "Subscribed";
    case "resub": {
      const cumulativeMonths = tags["msg-param-cumulative-months"];
      return cumulativeMonths ? `Resubscribed ${cumulativeMonths} months` : "Resubscribed";
    }
    case "subgift": {
      const recipient = decodeIrcTagValue(tags["msg-param-recipient-display-name"]);
      return recipient ? `Gifted a sub to ${recipient}` : "Gifted a sub";
    }
    case "submysterygift": {
      const giftCount = tags["msg-param-mass-gift-count"];
      return giftCount ? `Gifted ${giftCount} subs` : "Gifted subs";
    }
    case "raid": {
      const viewerCount = tags["msg-param-viewerCount"];
      return viewerCount ? `Raided with ${viewerCount} viewers` : "Raided";
    }
    case "bitsbadgetier": {
      const threshold = tags["msg-param-threshold"];
      return threshold ? `Cheered ${threshold} bits` : "Cheered bits";
    }
    default:
      return decodeIrcTagValue(tags["system-msg"]) || "Twitch event";
  }
}

function getTwitchUserNoticeType(tags: Record<string, string>): ChatMessage["eventType"] {
  const messageId = tags["msg-id"];

  if (messageId === "raid") {
    return "raid";
  }

  if (messageId === "subgift" || messageId === "submysterygift") {
    return "subgift";
  }

  if (messageId === "sub" || messageId === "resub") {
    return "sub";
  }

  return "system";
}

function parseTwitchMessage(line: string): ChatMessage | null {
  const receivedAt = Date.now();
  const noticeMatch = line.match(
    /^(?:@([^ ]+) )?:tmi\.twitch\.tv USERNOTICE #([^ ]+)(?: :(.*))?$/,
  );

  if (noticeMatch?.[2]) {
    const tags = parseIrcTags(noticeMatch[1]);
    const author =
      decodeIrcTagValue(tags["display-name"]) ||
      decodeIrcTagValue(tags.login) ||
      "Twitch";
    const text =
      noticeMatch[3] ||
      decodeIrcTagValue(tags["system-msg"]) ||
      getTwitchUserNoticeLabel(tags);

    return {
      id: tags.id
        ? `twitch:${tags.id}`
        : `twitch:usernotice:${noticeMatch[2]}:${Date.now()}:${Math.random()}`,
      platform: "Twitch",
      author,
      authorColor: tags.color || undefined,
      channel: noticeMatch[2],
      eventLabel: getTwitchUserNoticeLabel(tags),
      eventType: getTwitchUserNoticeType(tags),
      receivedAt,
      text,
      time: formatMessageTime(new Date(receivedAt)),
    };
  }

  const match = line.match(/^(?:@([^ ]+) )?:([^!]+)![^ ]+ PRIVMSG #([^ ]+) :(.*)$/);

  if (!match?.[2] || !match[3] || !match[4]) {
    return null;
  }

  const tags = parseIrcTags(match[1]);
  const bits = parsePositiveNumber(tags.bits);

  return {
    id: tags.id
      ? `twitch:${tags.id}`
      : `twitch:fallback:${match[3]}:${Date.now()}:${Math.random()}`,
    platform: "Twitch",
    author: decodeIrcTagValue(tags["display-name"]) || match[2],
    authorColor: tags.color || undefined,
    bits,
    channel: match[3],
    emotes: parseTwitchEmotes(tags.emotes, match[4]),
    eventLabel: bits ? `${bits} bits` : undefined,
    eventType: bits ? "bits" : tags["first-msg"] === "1" ? "first-message" : undefined,
    firstMessage: tags["first-msg"] === "1",
    receivedAt,
    text: match[4],
    time: formatMessageTime(new Date(receivedAt)),
  };
}

function parseKickMessage(rawData: string): ChatMessage | null {
  try {
    const data = JSON.parse(rawData);
    const text = stripChatHtml(String(data?.content ?? ""));
    const receivedAt = data.created_at ? new Date(data.created_at).getTime() : Date.now();

    if (!data?.sender?.username || !text) {
      return null;
    }

    return {
      id: data.id
        ? `kick:${data.id}`
        : `kick:fallback:${Date.now()}:${Math.random()}`,
      platform: "Kick",
      author: data.sender.username,
      authorColor: data.sender.identity?.color,
      receivedAt: Number.isFinite(receivedAt) ? receivedAt : Date.now(),
      text,
      time: formatMessageTime(new Date(Number.isFinite(receivedAt) ? receivedAt : Date.now())),
    };
  } catch {
    return null;
  }
}

function formatMessageTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getMockPlatform(channelValue: string, sequence: number) {
  const platformSequence =
    mockPlatformSequences[channelValue] ?? mockPlatformSequences.ansem;

  return platformSequence[sequence % platformSequence.length] ?? "Kick";
}

function createMockStreamMessage(sequence: number, channelValue: string): ChatMessage {
  const platform = getMockPlatform(channelValue, sequence);
  const platformTemplates = mockStreamTemplates.filter(
    (template) => template.platform === platform,
  );
  const templatePool = platformTemplates.length > 0 ? platformTemplates : mockStreamTemplates;
  const template = templatePool[sequence % templatePool.length] ?? mockStreamTemplates[0];

  return {
    ...template,
    id: `mock-stream-${sequence}-${Date.now()}`,
    receivedAt: Date.now(),
    time: formatMessageTime(new Date()),
  };
}

function mapStoredEventToChatMessage(event: CommunityChatEvent): ChatMessage {
  return {
    author: event.author,
    authorColor: event.color,
    bits: event.bits,
    channel: event.channel,
    eventLabel: event.eventLabel,
    eventType: event.eventType,
    firstMessage: event.firstMessage,
    id: event.sourceId,
    platform: event.platform,
    receivedAt: event.receivedAt,
    text: event.text,
    time: formatMessageTime(new Date(event.receivedAt)),
  };
}

function mapChatMessageToStoredEvent(message: ChatMessage): CommunityChatEvent {
  const receivedAt = message.receivedAt ?? Date.now();

  return {
    author: message.author,
    ...(message.bits ? { bits: message.bits } : {}),
    ...(message.channel ? { channel: message.channel } : {}),
    color: message.authorColor ?? getAuthorColor(message.author),
    ...(message.eventLabel ? { eventLabel: message.eventLabel } : {}),
    ...(message.eventType ? { eventType: message.eventType } : {}),
    ...(message.firstMessage ? { firstMessage: true } : {}),
    platform: message.platform,
    receivedAt,
    sourceId: message.id,
    text: message.text,
  };
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

function getEmoteUrl(provider: ChatEmote["provider"], id: string) {
  if (provider === "7tv") {
    return `https://cdn.7tv.app/emote/${encodeURIComponent(id)}/2x.webp`;
  }

  if (provider === "bttv") {
    return `https://cdn.betterttv.net/emote/${encodeURIComponent(id)}/2x`;
  }

  if (provider === "ffz") {
    return `https://cdn.frankerfacez.com/emote/${encodeURIComponent(id)}/2`;
  }

  if (provider === "tw") {
    return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(
      id,
    )}/default/dark/2.0`;
  }

  return "";
}

function ChatEmoteImage({
  className = "chat-emote",
  id,
  name,
  provider,
}: {
  className?: string;
  id: string;
  name: string;
  provider: ChatEmote["provider"];
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <span className="chat-emote-fallback">{name}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={name}
      className={className}
      loading="lazy"
      src={getEmoteUrl(provider, id)}
      title={name}
      onError={() => {
        setErrored(true);
      }}
    />
  );
}

function KickEmoteImage({ id, name }: { id: string; name: string }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <span className="chat-emote-fallback">{name}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={name}
      className="chat-emote"
      loading="lazy"
      src={`https://files.kick.com/emotes/${encodeURIComponent(id)}/fullsize`}
      title={name}
      onError={() => {
        setErrored(true);
      }}
    />
  );
}

function ThirdPartyEmoteImage({ emote }: { emote: ThirdPartyChatEmote }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <span className="chat-emote-fallback">{emote.name}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={emote.name}
      className="chat-emote"
      loading="lazy"
      src={emote.url}
      title={`${emote.name} (${emote.provider.toUpperCase()})`}
      onError={() => {
        setErrored(true);
      }}
    />
  );
}

function formatTickerPrice(price: number | null, currency: string) {
  if (price === null) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat(undefined, {
    currency: currency || "USD",
    maximumFractionDigits: price >= 100 ? 2 : price >= 1 ? 2 : 4,
    minimumFractionDigits: price >= 100 ? 2 : price >= 1 ? 2 : 4,
    style: "currency",
  }).format(price);
}

function formatTickerChange(changePercent: number | null) {
  if (changePercent === null) {
    return "--";
  }

  return `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`;
}

function getTickerHoverAsset(tag: string) {
  const normalizedTag = tag.toUpperCase();
  const cachedAsset = tickerHoverCache.get(normalizedTag);

  if (cachedAsset) {
    return cachedAsset;
  }

  const assetPromise = fetch(
    `/api/market-asset?symbol=${encodeURIComponent(normalizedTag)}&name=${encodeURIComponent(normalizedTag)}`,
    { cache: "no-store" },
  ).then((response) => {
    if (!response.ok) {
      throw new Error("Unable to load ticker.");
    }

    return response.json() as Promise<TickerHoverAsset>;
  });

  tickerHoverCache.set(normalizedTag, assetPromise);
  return assetPromise;
}

function getMessageCashtags(text: string) {
  const tags: string[] = [];
  const seenTags = new Set<string>();
  const tokenPattern = /\$([A-Za-z][A-Za-z0-9]{1,9})\b/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    const tag = match[1]?.toUpperCase();

    if (tag && !seenTags.has(tag)) {
      seenTags.add(tag);
      tags.push(tag);
    }
  }

  return tags.slice(0, 3);
}

function TickerMiniChart({ points }: { points: TickerHoverAsset["chart"] }) {
  const values = points.map((point) => point.close).filter((value) => Number.isFinite(value));

  if (values.length < 2) {
    return <span className="chat-ticker-chart-empty" aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 96;
      const y = 34 - ((value - min) / range) * 28;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      className="chat-ticker-chart"
      viewBox="0 0 96 40"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

function TickerAssetMark({
  asset,
  fallbackTag,
  className = "chat-ticker-image",
}: {
  asset?: TickerHoverAsset["asset"] | null;
  className?: string;
  fallbackTag: string;
}) {
  const [imageErrored, setImageErrored] = useState(false);
  const imageUrl =
    asset?.imageUrl ?? tickerImageFallbacks[(asset?.ticker ?? fallbackTag).toUpperCase()];

  if (imageUrl && !imageErrored) {
    return (
      <span className={className} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          loading="lazy"
          src={imageUrl}
          onError={() => {
            setImageErrored(true);
          }}
        />
      </span>
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {(asset?.ticker ?? fallbackTag).slice(0, 3)}
    </span>
  );
}

function ChatTickerInlineCard({ tag }: { tag: string }) {
  const [asset, setAsset] = useState<TickerHoverAsset | null>(null);
  const [errored, setErrored] = useState(false);
  const normalizedTag = tag.toUpperCase();

  useEffect(() => {
    let active = true;

    getTickerHoverAsset(normalizedTag)
      .then((payload) => {
        if (active) {
          setAsset(payload);
        }
      })
      .catch(() => {
        tickerHoverCache.delete(normalizedTag);

        if (active) {
          setErrored(true);
        }
      });

    return () => {
      active = false;
    };
  }, [normalizedTag]);

  const changePercent = asset?.changePercent ?? null;
  const changeDirection =
    changePercent === null ? "flat" : changePercent >= 0 ? "up" : "down";
  const ticker = asset?.asset.ticker ?? normalizedTag;

  return (
    <a
      className="chat-ticker-card"
      data-loading={!asset && !errored ? "true" : undefined}
      data-unavailable={errored ? "true" : undefined}
      href={`https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`}
      rel="noreferrer"
      target="_blank"
      title={`Open ${ticker} quote`}
    >
      <TickerAssetMark
        asset={asset?.asset}
        className="chat-ticker-card-image"
        fallbackTag={normalizedTag}
      />
      <span className="chat-ticker-card-title">
        <strong>{asset?.asset.name ?? normalizedTag}</strong>
        <span className="chat-ticker-card-meta">
          <span>{ticker}</span>
          <strong>
            {errored
              ? "Unavailable"
              : asset
                ? formatTickerPrice(asset.price, asset.currency)
                : "Loading"}
          </strong>
          <span data-direction={changeDirection}>
            {asset ? formatTickerChange(changePercent) : "--"}
          </span>
        </span>
      </span>
      <span className="chat-ticker-card-chart">
        <TickerMiniChart points={asset?.chart ?? []} />
      </span>
    </a>
  );
}

function ChatMessageTickerCards({
  enabled = true,
  text,
}: {
  enabled?: boolean;
  text: string;
}) {
  const tags = useMemo(() => getMessageCashtags(text), [text]);
  const tickerCardsRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(
    () => typeof window !== "undefined" && !("IntersectionObserver" in window),
  );

  useEffect(() => {
    if (!enabled || shouldLoad || tags.length === 0) {
      return;
    }

    const tickerCards = tickerCardsRef.current;

    if (!tickerCards) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        setShouldLoad(true);
        observer.disconnect();
      },
      {
        rootMargin: "520px 0px",
      },
    );

    observer.observe(tickerCards);

    return () => {
      observer.disconnect();
    };
  }, [enabled, shouldLoad, tags.length]);

  if (!enabled || tags.length === 0) {
    return null;
  }

  return (
    <div
      className="chat-ticker-cards"
      data-lazy={shouldLoad ? undefined : "true"}
      ref={tickerCardsRef}
      aria-label="Message ticker quotes"
    >
      {shouldLoad
        ? tags.map((tag) => (
            <ChatTickerInlineCard key={tag} tag={tag} />
          ))
        : tags.map((tag) => (
            <span className="chat-ticker-card chat-ticker-card-placeholder" key={tag}>
              ${tag}
            </span>
          ))}
    </div>
  );
}

function ChatCashtag({ tag }: { tag: string }) {
  const normalizedTag = tag.toUpperCase();

  return <span className="chat-cashtag">${normalizedTag}</span>;
}

function renderThirdPartyText(
  text: string,
  keyPrefix: string,
  thirdPartyEmotes: Record<string, ThirdPartyChatEmote>,
): ReactNode[] {
  return text.split(/(\s+)/).map((part, index) => {
    if (!part || /^\s+$/.test(part)) {
      return part;
    }

    const emote = thirdPartyEmotes[part];

    if (!emote) {
      return part;
    }

    return (
      <ThirdPartyEmoteImage
        emote={emote}
        key={`${keyPrefix}-third-party-${index}`}
      />
    );
  });
}

function renderPlainMessageText(
  text: string,
  keyPrefix: string,
  thirdPartyEmotes: Record<string, ThirdPartyChatEmote>,
): ReactNode[] {
  const tokenPattern =
    /\[emote:(\d+):([^\]]+)\]|\[temote:(\w+):([\w-]+):([^\]]+)\]|\$([A-Za-z][A-Za-z0-9]{1,9})\b/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderThirdPartyText(
          text.slice(lastIndex, match.index),
          `${keyPrefix}-third-party-${tokenIndex}`,
          thirdPartyEmotes,
        ),
      );
    }

    if (match[1] && match[2]) {
      nodes.push(
        <KickEmoteImage
          id={match[1]}
          key={`${keyPrefix}-kick-${tokenIndex}`}
          name={match[2]}
        />,
      );
    } else if (match[3] && match[4] && match[5]) {
      const provider = match[3].toLowerCase();
      const validProvider =
        provider === "tw" ||
        provider === "7tv" ||
        provider === "bttv" ||
        provider === "ffz"
          ? provider
          : null;

      nodes.push(
        validProvider ? (
          <ChatEmoteImage
            id={match[4]}
            key={`${keyPrefix}-emote-${tokenIndex}`}
            name={match[5]}
            provider={validProvider}
          />
        ) : (
          match[5]
        ),
      );
    } else if (match[6]) {
      nodes.push(
        <ChatCashtag
          key={`${keyPrefix}-cashtag-${tokenIndex}`}
          tag={match[6].toUpperCase()}
        />,
      );
    }

    tokenIndex += 1;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      ...renderThirdPartyText(
        text.slice(lastIndex),
        `${keyPrefix}-third-party-tail`,
        thirdPartyEmotes,
      ),
    );
  }

  return nodes;
}

function renderMessageText(
  message: ChatMessage,
  thirdPartyEmotes: Record<string, ThirdPartyChatEmote>,
): ReactNode[] {
  if (!message.emotes?.length) {
    return renderPlainMessageText(message.text, message.id, thirdPartyEmotes);
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let emoteIndex = 0;

  for (const emote of message.emotes) {
    if (emote.start < cursor) {
      continue;
    }

    if (emote.start > cursor) {
      nodes.push(
        ...renderPlainMessageText(
          message.text.slice(cursor, emote.start),
          `${message.id}-plain-${emoteIndex}`,
          thirdPartyEmotes,
        ),
      );
    }

    nodes.push(
      <ChatEmoteImage
        id={emote.id}
        key={`${message.id}-tw-${emote.id}-${emote.start}`}
        name={emote.name}
        provider={emote.provider}
      />,
    );

    cursor = emote.end + 1;
    emoteIndex += 1;
  }

  if (cursor < message.text.length) {
    nodes.push(
      ...renderPlainMessageText(
        message.text.slice(cursor),
        `${message.id}-tail`,
        thirdPartyEmotes,
      ),
    );
  }

  return nodes;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    compactDisplay: "short",
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function ProfileHoverCard({
  option,
  profiles,
}: {
  option: ChannelOption;
  profiles: Record<string, XProfile>;
}) {
  return (
    <div className="profile-hover-card" role="tooltip">
      {option.xHandles.map((handle) => {
        const profile = profiles[handle.toLowerCase()];

        if (!profile) {
          return (
            <div className="profile-hover-profile" key={handle}>
              <div className="profile-hover-avatar profile-hover-avatar-empty" />
              <div className="profile-hover-loading">Loading @{handle}</div>
            </div>
          );
        }

        return (
          <div className="profile-hover-profile" key={profile.handle}>
            <div className="profile-hover-top">
              <span
                className="profile-hover-avatar"
                style={
                  profile.avatarUrl
                    ? { backgroundImage: `url(${profile.avatarUrl})` }
                    : undefined
                }
              />
              <span className="profile-hover-follow">Following</span>
            </div>
            <div className="profile-hover-name-row">
              <span className="profile-hover-name">{profile.name}</span>
              {profile.verified && (
                <FiCheckCircle className="profile-hover-verified" aria-label="Verified" />
              )}
            </div>
            <div className="profile-hover-handle">@{profile.handle}</div>
            <p className="profile-hover-description">{profile.description}</p>
            <div className="profile-hover-stats">
              <span>
                <strong>{formatCompactNumber(profile.following)}</strong> Following
              </span>
              <span>
                <strong>{formatCompactNumber(profile.followers)}</strong> Followers
              </span>
            </div>
            <a
              className="profile-hover-summary"
              href={profile.profileUrl}
              rel="noreferrer"
              target="_blank"
            >
              <SiX aria-hidden="true" />
              Profile Summary
            </a>
          </div>
        );
      })}
    </div>
  );
}

const ChatMessageArticle = memo(function ChatMessageArticle({
  enableTickerCards,
  message,
  onPause,
  onResume,
  thirdPartyEmotes,
}: {
  enableTickerCards: boolean;
  message: ChatMessage;
  onPause: () => void;
  onResume: () => void;
  thirdPartyEmotes: Record<string, ThirdPartyChatEmote>;
}) {
  const renderedText = useMemo(
    () => renderMessageText(message, thirdPartyEmotes),
    [message, thirdPartyEmotes],
  );

  return (
    <article
      className={[
        "chat-message",
        message.firstMessage ? "chat-message-first-time" : "",
        message.eventLabel ? "chat-message-event" : "",
      ].filter(Boolean).join(" ")}
      tabIndex={0}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
      aria-label={`${message.author} from ${message.platform}: ${message.text}`}
    >
      <div className="chat-message-meta">
        <span className="chat-time">{message.time}</span>
        <span className="chat-author-group">
          <span
            className={`chat-platform-badge chat-platform-badge-${message.platform.toLowerCase()}`}
            aria-label={message.platform}
            style={{ color: platformLogoColors[message.platform] }}
          >
            <PlatformLogo platform={message.platform} />
          </span>
          <span
            className="chat-author"
            style={{ color: message.authorColor ?? getAuthorColor(message.author) }}
          >
            {message.author}
          </span>
          {message.firstMessage ? (
            <span className="chat-message-badge chat-message-badge-first">
              First time
            </span>
          ) : null}
          {message.eventLabel ? (
            <span className="chat-message-badge chat-message-badge-event">
              {message.eventLabel}
            </span>
          ) : null}
        </span>
      </div>
      <p>{renderedText}</p>
      <ChatMessageTickerCards enabled={enableTickerCards} text={message.text} />
    </article>
  );
});

type AggregatedChatProps = {
  channelOptions: ChannelOption[];
  enableDirectChatSockets?: boolean;
  enablePopout?: boolean;
  enableServerLiveEvents?: boolean;
  enableTickerCards?: boolean;
  liveEventsPollMs?: number;
  maxMessagesPerPlatform?: number;
  messageRenderLimit?: number;
  mode?: "default" | "embedded" | "popout";
  monitoredSources: SourceSet;
  onChannelChange: (channelValue: string) => void;
  searchQuery?: string;
  selectedChannelValue: string;
  showStats?: boolean;
  useMockData?: boolean;
  visiblePlatforms?: Platform[];
  viewMode?: "chatters" | "messages";
};

function AggregatedChatComponent({
  channelOptions,
  enableDirectChatSockets = true,
  enablePopout = true,
  enableServerLiveEvents = true,
  enableTickerCards = true,
  liveEventsPollMs = 6000,
  maxMessagesPerPlatform = defaultMaxMessagesPerPlatform,
  messageRenderLimit = 180,
  mode = "default",
  monitoredSources,
  onChannelChange,
  searchQuery = "",
  selectedChannelValue,
  showStats = true,
  useMockData = true,
  visiblePlatforms = platforms,
  viewMode = "messages",
}: AggregatedChatProps) {
  const initialMessages = useMockData ? mockChatMessages : [];
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => (useMockData ? mockRecordedAt : Date.now()));
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState<ChatStats>(() =>
    createInitialChatStats(initialMessages),
  );
  const [streamMetrics, setStreamMetrics] = useState<StreamMetrics>(() =>
    useMockData ? getMockStreamMetrics(selectedChannelValue) : emptyStreamMetrics,
  );
  const [profileTooltip, setProfileTooltip] = useState<{
    option: ChannelOption;
    x: number;
    y: number;
  } | null>(null);
  const [chatContextMenu, setChatContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [statsNumbersReady, setStatsNumbersReady] = useState(false);
  const [thirdPartyEmotes, setThirdPartyEmotes] = useState<
    Record<string, ThirdPartyChatEmote>
  >({});
  const [xProfiles, setXProfiles] = useState<Record<string, XProfile>>({});
  const pausedRef = useRef(false);
  const bufferedMessagesRef = useRef<ChatMessage[]>([]);
  const chatFeedRef = useRef<HTMLDivElement | null>(null);
  const hoverPausedRef = useRef(false);
  const feedHoverPausedRef = useRef(false);
  const contextMenuPausedRef = useRef(false);
  const mockMessageIndexRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const scrollPausedRef = useRef(false);
  const scrollResumeTimeoutRef = useRef<number | null>(null);
  const seenLiveSourceIdsRef = useRef<Set<string>>(new Set());
  const pendingPersistMessagesRef = useRef<ChatMessage[]>([]);
  const persistTimeoutRef = useRef<number | null>(null);
  const chatTwitchChannelsKey = monitoredSources.twitchChannels.join(",");
  const kickChannelsKey = monitoredSources.kickChannels
    .map((kickChannel) => `${kickChannel.channel}:${kickChannel.chatroomId}`)
    .join(",");
  const xHandlesKey = monitoredSources.xHandles.join(",");
  const profileHandlesKey = Array.from(
    new Set(channelOptions.flatMap((channelOption) => channelOption.xHandles)),
  )
    .sort()
    .join(",");
  const selectedChannelIndex = Math.max(
    0,
    channelOptions.findIndex(
      (channelOption) => channelOption.value === selectedChannelValue,
    ),
  );
  const selectedChannelLabel =
    channelOptions.find((channelOption) => channelOption.value === selectedChannelValue)
      ?.label ?? "Channel";
  const mockStreamMetrics = getMockStreamMetrics(selectedChannelValue);
  const mockChatStats = getMockChatStats(selectedChannelValue);
  const channelSwitcherStyle = {
    "--channel-active-offset":
      selectedChannelIndex === 0
        ? "0px"
        : `calc(${selectedChannelIndex * 100}% + ${
            selectedChannelIndex * 0.28
          }rem)`,
  } as CSSProperties;
  const visiblePlatformSet = useMemo(() => new Set(visiblePlatforms), [visiblePlatforms]);
  const normalizedSearchQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery],
  );
  const visibleMessages = useMemo(() => messages.filter((message) => {
    if (!visiblePlatformSet.has(message.platform)) {
      return false;
    }

    if (!normalizedSearchQuery) {
      return true;
    }

    return (
      message.author.toLowerCase().includes(normalizedSearchQuery) ||
      message.text.toLowerCase().includes(normalizedSearchQuery)
    );
  }), [messages, normalizedSearchQuery, visiblePlatformSet]);
  const renderedMessages = useMemo(() => {
    if (viewMode !== "messages" || normalizedSearchQuery) {
      return visibleMessages;
    }

    return visibleMessages.slice(-messageRenderLimit);
  }, [messageRenderLimit, normalizedSearchQuery, viewMode, visibleMessages]);
  const chatterRows = useMemo(() => {
    if (viewMode !== "chatters") {
      return [];
    }

    const chatterMap = new Map<
      string,
      {
        author: string;
        color?: string;
        count: number;
        firstMessage: boolean;
        key: string;
        lastMessage: string;
        lastTime: string;
        platformCounts: Record<Platform, number>;
      }
    >();

    for (const message of visibleMessages) {
      const key = message.author.toLowerCase();
      const chatter = chatterMap.get(key) ?? {
        author: message.author,
        color: message.authorColor,
        count: 0,
        firstMessage: false,
        key,
        lastMessage: "",
        lastTime: "",
        platformCounts: createPlatformCounts(),
      };

      chatter.author = message.author;
      chatter.color = message.authorColor ?? chatter.color;
      chatter.count += 1;
      chatter.firstMessage = chatter.firstMessage || message.firstMessage === true;
      chatter.lastMessage = message.text;
      chatter.lastTime = message.time;
      chatter.platformCounts[message.platform] += 1;
      chatterMap.set(key, chatter);
    }

    return Array.from(chatterMap.values())
      .map((chatter) => ({
        ...chatter,
        firstMessage: chatter.firstMessage || chatter.count === 1,
      }))
      .toSorted((first, second) => second.count - first.count);
  }, [viewMode, visibleMessages]);
  const topChatters = chatterRows.slice(0, 5);
  const topChatterKeys = new Set(topChatters.map((chatter) => chatter.key));
  const firstTimeChatters = chatterRows
    .filter((chatter) => chatter.firstMessage && !topChatterKeys.has(chatter.key))
    .slice(0, 25);
  const maxBufferedMessages = maxMessagesPerPlatform * platforms.length;

  const trimMessagesByPlatform = useCallback((nextMessages: ChatMessage[]) => {
    const platformCounts = createPlatformCounts();

    return nextMessages
      .toReversed()
      .filter((message) => {
        if (platformCounts[message.platform] >= maxMessagesPerPlatform) {
          return false;
        }

        platformCounts[message.platform] += 1;
        return true;
      })
      .toReversed();
  }, [maxMessagesPerPlatform]);

  const appendMessages = useCallback((incomingMessages: ChatMessage[]) => {
    setMessages((currentMessages) =>
      trimMessagesByPlatform([...currentMessages, ...incomingMessages]),
    );
  }, [trimMessagesByPlatform]);

  const persistMessages = useCallback((incomingMessages: ChatMessage[]) => {
    if (useMockData || incomingMessages.length === 0) {
      return;
    }

    pendingPersistMessagesRef.current = [
      ...pendingPersistMessagesRef.current,
      ...incomingMessages,
    ].slice(-160);

    if (persistTimeoutRef.current !== null) {
      return;
    }

    persistTimeoutRef.current = window.setTimeout(() => {
      persistTimeoutRef.current = null;
      const queuedMessages = pendingPersistMessagesRef.current;
      pendingPersistMessagesRef.current = [];

      if (queuedMessages.length === 0) {
        return;
      }

      const events = Array.from(
        new Map(
          queuedMessages.map((message) => [
            message.id,
            mapChatMessageToStoredEvent(message),
          ]),
        ).values(),
      );

      void fetch("/api/community-top-chat", {
        body: JSON.stringify({ events }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }).catch(() => {
        pendingPersistMessagesRef.current = [
          ...events.map(mapStoredEventToChatMessage),
          ...pendingPersistMessagesRef.current,
        ].slice(-160);
      });
    }, 900);
  }, [useMockData]);

  const showProfileTooltip = useCallback(
    (channelOption: ChannelOption, x: number, y: number) => {
      if (channelOption.value === "both") {
        setProfileTooltip(null);
        return;
      }

      setProfileTooltip({
        option: channelOption,
        x,
        y,
      });
    },
    [],
  );

  const recordStats = useCallback((incomingMessages: ChatMessage[]) => {
    if (!showStats) {
      return;
    }

    const recordedAt = Date.now();

    setNow(recordedAt);
    setStats((currentStats) => {
      const activeChatters = { ...currentStats.activeChatters };
      const platformCounts = { ...currentStats.platformCounts };

      for (const message of incomingMessages) {
        activeChatters[`${message.platform}:${message.author.toLowerCase()}`] = recordedAt;
        platformCounts[message.platform] += 1;
      }

      for (const [authorKey, lastSeenAt] of Object.entries(activeChatters)) {
        if (recordedAt - lastSeenAt > activeWindowMs) {
          delete activeChatters[authorKey];
        }
      }

      return {
        activeChatters,
        messageTimes: [
          ...currentStats.messageTimes.filter(
            (messageTime) => recordedAt - messageTime <= rateWindowMs,
          ),
          ...incomingMessages.map(() => recordedAt),
        ],
        platformCounts,
        totalMessages: currentStats.totalMessages + incomingMessages.length,
      };
    });
  }, [showStats]);

  const pauseChat = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resumeChat = useCallback(() => {
    if (
      hoverPausedRef.current ||
      feedHoverPausedRef.current ||
      scrollPausedRef.current ||
      contextMenuPausedRef.current
    ) {
      return;
    }

    pausedRef.current = false;
    setPaused(false);

    if (bufferedMessagesRef.current.length > 0) {
      appendMessages(bufferedMessagesRef.current);
      bufferedMessagesRef.current = [];
    }
  }, [appendMessages]);

  const pauseChatMessage = useCallback(() => {
    hoverPausedRef.current = true;
    pauseChat();
  }, [pauseChat]);

  const resumeChatMessage = useCallback(() => {
    hoverPausedRef.current = false;
    resumeChat();
  }, [resumeChat]);

  const closeChatContextMenu = useCallback(() => {
    setChatContextMenu(null);

    if (contextMenuPausedRef.current) {
      contextMenuPausedRef.current = false;
      resumeChat();
    }
  }, [resumeChat]);

  const handleChatContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (!enablePopout || mode === "popout") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const menuWidth = 176;
      const menuHeight = 92;
      const x = Math.max(
        8,
        Math.min(event.clientX, window.innerWidth - menuWidth - 8),
      );
      const y = Math.max(
        8,
        Math.min(event.clientY, window.innerHeight - menuHeight - 8),
      );

      contextMenuPausedRef.current = true;
      pauseChat();
      setChatContextMenu({ x, y });
    },
    [enablePopout, mode, pauseChat],
  );

  const handlePopOutChat = useCallback(() => {
    const popoutUrl = new URL("/chat-popout", window.location.origin);

    popoutUrl.searchParams.set("channel", selectedChannelValue);
    window.open(
      popoutUrl.toString(),
      "_blank",
      [
        "popup=yes",
        "width=420",
        "height=760",
        "left=96",
        "top=72",
        "noopener",
        "noreferrer",
      ].join(","),
    );
    closeChatContextMenu();
  }, [closeChatContextMenu, selectedChannelValue]);

  const handleToggleChatFullscreen = useCallback(() => {
    setChatExpanded((currentExpanded) => !currentExpanded);
    closeChatContextMenu();
  }, [closeChatContextMenu]);

  const handleExitChatFullscreen = useCallback(() => {
    setChatExpanded(false);
    closeChatContextMenu();
  }, [closeChatContextMenu]);

  const handleChatScroll = useCallback(() => {
    if (programmaticScrollRef.current) {
      return;
    }

    scrollPausedRef.current = true;
    pauseChat();

    if (scrollResumeTimeoutRef.current !== null) {
      window.clearTimeout(scrollResumeTimeoutRef.current);
    }

    scrollResumeTimeoutRef.current = window.setTimeout(() => {
      scrollPausedRef.current = false;
      scrollResumeTimeoutRef.current = null;
      resumeChat();
    }, 1100);
  }, [pauseChat, resumeChat]);

  const handleChatFeedMouseEnter = useCallback(() => {
    feedHoverPausedRef.current = true;
    pauseChat();
  }, [pauseChat]);

  const handleChatFeedMouseLeave = useCallback(() => {
    feedHoverPausedRef.current = false;
    resumeChat();
  }, [resumeChat]);

  useEffect(() => {
    if (!useMockData) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const messagesToEmit =
        mockMessageIndexRef.current % 4 === 0
          ? [
              createMockStreamMessage(
                mockMessageIndexRef.current,
                selectedChannelValue,
              ),
              createMockStreamMessage(
                mockMessageIndexRef.current + 1,
                selectedChannelValue,
              ),
            ]
          : [
              createMockStreamMessage(
                mockMessageIndexRef.current,
                selectedChannelValue,
              ),
            ];

      mockMessageIndexRef.current += messagesToEmit.length;
      recordStats(messagesToEmit);

      if (pausedRef.current) {
        bufferedMessagesRef.current = [
          ...bufferedMessagesRef.current,
          ...messagesToEmit,
        ].slice(-maxBufferedMessages);
        return;
      }

      appendMessages(messagesToEmit);
    }, 720);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appendMessages, maxBufferedMessages, recordStats, selectedChannelValue, useMockData]);

  useEffect(() => {
    if (!enableServerLiveEvents) {
      return;
    }

    let active = true;

    const activeTwitchChannels = chatTwitchChannelsKey
      .split(",")
      .filter(Boolean)
      .map((channel) => channel.toLowerCase());
    const activeKickChannels = kickChannelsKey
      .split(",")
      .filter(Boolean)
      .map((entry) => entry.split(":")[0]?.toLowerCase())
      .filter(Boolean);
    const activeXHandles = xHandlesKey
      .split(",")
      .filter(Boolean)
      .map((handle) => handle.toLowerCase());

    function eventMatchesSources(event: CommunityChatEvent) {
      const channel = event.channel?.toLowerCase();

      if (!channel) {
        return (
          (event.platform === "Twitch" && activeTwitchChannels.length > 0) ||
          (event.platform === "Kick" && activeKickChannels.length > 0) ||
          (event.platform === "X" && activeXHandles.length > 0)
        );
      }

      if (event.platform === "Twitch") {
        return activeTwitchChannels.includes(channel);
      }

      if (event.platform === "Kick") {
        return activeKickChannels.includes(channel);
      }

      return activeXHandles.includes(channel);
    }

    const updateServerLiveEvents = async () => {
      try {
        const response = await fetch("/api/community-live-events?limit=100", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as CommunityLiveEventsResponse;

        if (!active || !payload.stored || payload.events.length === 0) {
          return;
        }

        const liveMessages = payload.events
          .filter(eventMatchesSources)
          .filter((event) => {
            if (seenLiveSourceIdsRef.current.has(event.sourceId)) {
              return false;
            }

            seenLiveSourceIdsRef.current.add(event.sourceId);
            return true;
          })
          .map(mapStoredEventToChatMessage);

        if (liveMessages.length === 0) {
          return;
        }

        setConnected(true);
        recordStats(liveMessages);

        if (pausedRef.current) {
          bufferedMessagesRef.current = [
            ...bufferedMessagesRef.current,
            ...liveMessages,
          ].slice(-maxBufferedMessages);
          return;
        }

        appendMessages(liveMessages);
      } catch {
        // Server-side chat ingestion is optional in local development.
      }
    };

    updateServerLiveEvents();
    const intervalId = window.setInterval(updateServerLiveEvents, liveEventsPollMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    appendMessages,
    chatTwitchChannelsKey,
    enableServerLiveEvents,
    kickChannelsKey,
    liveEventsPollMs,
    maxBufferedMessages,
    recordStats,
    xHandlesKey,
  ]);

  useEffect(() => {
    const activeXHandles = xHandlesKey
      .split(",")
      .map((handle) => handle.replace(/^@/, "").toLowerCase())
      .filter(Boolean);

    if (activeXHandles.length === 0) {
      return;
    }

    let active = true;
    const activeXHandleSet = new Set(activeXHandles);

    const updateXLiveChat = async () => {
      try {
        const liveChatUrl = new URL("/api/x-live-chat", window.location.origin);

        for (const handle of activeXHandles) {
          liveChatUrl.searchParams.append("handle", handle);
        }

        liveChatUrl.searchParams.set("limit", "40");

        const response = await fetch(liveChatUrl, { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as CommunityLiveEventsResponse;

        if (!active || payload.events.length === 0) {
          return;
        }

        const liveMessages = payload.events
          .filter((event) => {
            if (event.platform !== "X") {
              return false;
            }

            const channel = event.channel?.toLowerCase();

            return !channel || activeXHandleSet.has(channel);
          })
          .filter((event) => {
            if (seenLiveSourceIdsRef.current.has(event.sourceId)) {
              return false;
            }

            seenLiveSourceIdsRef.current.add(event.sourceId);
            return true;
          })
          .map(mapStoredEventToChatMessage);

        if (liveMessages.length === 0) {
          return;
        }

        setConnected(true);
        recordStats(liveMessages);
        persistMessages(liveMessages);

        if (pausedRef.current) {
          bufferedMessagesRef.current = [
            ...bufferedMessagesRef.current,
            ...liveMessages,
          ].slice(-maxBufferedMessages);
          return;
        }

        appendMessages(liveMessages);
      } catch {
        // Public X feeds are best-effort and can be rate-limited by upstream mirrors.
      }
    };

    updateXLiveChat();
    const intervalId = window.setInterval(updateXLiveChat, 30_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [appendMessages, maxBufferedMessages, persistMessages, recordStats, xHandlesKey]);

  useEffect(() => {
    const chatFeed = chatFeedRef.current;

    if (!chatFeed || pausedRef.current) {
      return;
    }

    programmaticScrollRef.current = true;
    chatFeed.scrollTop = chatFeed.scrollHeight;

    const timeoutId = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [renderedMessages.length]);

  useEffect(() => {
    return () => {
      if (scrollResumeTimeoutRef.current !== null) {
        window.clearTimeout(scrollResumeTimeoutRef.current);
      }

      if (persistTimeoutRef.current !== null) {
        window.clearTimeout(persistTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!chatContextMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".chat-context-menu")
      ) {
        return;
      }

      closeChatContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeChatContextMenu();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeChatContextMenu);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeChatContextMenu);
    };
  }, [chatContextMenu, closeChatContextMenu]);

  useEffect(() => {
    if (!chatExpanded || mode === "popout" || mode === "embedded") {
      document.body.removeAttribute("data-chat-expanded");
      return;
    }

    document.body.setAttribute("data-chat-expanded", "true");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleExitChatFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.removeAttribute("data-chat-expanded");
    };
  }, [chatExpanded, handleExitChatFullscreen, mode]);

  useEffect(() => {
    const activeTwitchChannels = chatTwitchChannelsKey.split(",").filter(Boolean);
    const activeKickChannels = kickChannelsKey
      .split(",")
      .filter(Boolean)
      .map((entry) => {
        const [channel = "", chatroomId = "0"] = entry.split(":");

        return {
          channel,
          chatroomId: Number(chatroomId),
        };
      })
      .filter((kickChannel) => kickChannel.channel && kickChannel.chatroomId > 0);
    const sockets: WebSocket[] = [];
    let openSocketCount = 0;

    if (!enableDirectChatSockets || !legacyClientChatSocketsEnabled) {
      return;
    }

    const markSocketOpen = () => {
      openSocketCount += 1;
      setConnected(true);
    };

    const markSocketClosed = () => {
      openSocketCount = Math.max(0, openSocketCount - 1);

      if (openSocketCount === 0) {
        setConnected(false);
      }
    };

    bufferedMessagesRef.current = [];

    if (activeTwitchChannels.length > 0) {
      const twitchSocket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

      sockets.push(twitchSocket);

      twitchSocket.addEventListener("open", () => {
        twitchSocket.send("CAP REQ :twitch.tv/tags");
        twitchSocket.send("PASS SCHMOOPIIE");
        twitchSocket.send(`NICK justinfan${Math.floor(Math.random() * 900000) + 100000}`);
        for (const twitchChannel of activeTwitchChannels) {
          twitchSocket.send(`JOIN #${twitchChannel}`);
        }
        markSocketOpen();
      });

      twitchSocket.addEventListener("message", (event) => {
        const lines = String(event.data).split("\r\n");

        const incomingMessages: ChatMessage[] = [];

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

        const unseenMessages = incomingMessages.filter((message) => {
          if (seenLiveSourceIdsRef.current.has(message.id)) {
            return false;
          }

          seenLiveSourceIdsRef.current.add(message.id);
          return true;
        });

        if (unseenMessages.length === 0) {
          return;
        }

        recordStats(unseenMessages);
        persistMessages(unseenMessages);

        if (pausedRef.current) {
          bufferedMessagesRef.current = [
            ...bufferedMessagesRef.current,
            ...unseenMessages,
          ].slice(-maxBufferedMessages);
          return;
        }

        appendMessages(unseenMessages);
      });

      twitchSocket.addEventListener("close", markSocketClosed);

      twitchSocket.addEventListener("error", markSocketClosed);
    }

    if (activeKickChannels.length > 0) {
      const kickSocket = new WebSocket(kickPusherUrl);

      sockets.push(kickSocket);

      kickSocket.addEventListener("open", markSocketOpen);

      kickSocket.addEventListener("message", (event) => {
        let message: { event?: string; data?: string };

        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (message.event === "pusher:connection_established") {
          for (const kickChannel of activeKickChannels) {
            kickSocket.send(
              JSON.stringify({
                event: "pusher:subscribe",
                data: {
                  auth: "",
                  channel: `chatrooms.${kickChannel.chatroomId}.v2`,
                },
              }),
            );
          }
          return;
        }

        if (message.event !== "App\\Events\\ChatMessageEvent") {
          return;
        }

        if (typeof message.data !== "string") {
          return;
        }

        const kickMessage = parseKickMessage(message.data);

        if (!kickMessage) {
          return;
        }

        if (seenLiveSourceIdsRef.current.has(kickMessage.id)) {
          return;
        }

        seenLiveSourceIdsRef.current.add(kickMessage.id);
        recordStats([kickMessage]);
        persistMessages([kickMessage]);

        if (pausedRef.current) {
          bufferedMessagesRef.current = [
            ...bufferedMessagesRef.current,
            kickMessage,
          ].slice(-maxBufferedMessages);
          return;
        }

        appendMessages([kickMessage]);
      });

      kickSocket.addEventListener("close", markSocketClosed);

      kickSocket.addEventListener("error", markSocketClosed);
    }

    return () => {
      for (const socket of sockets) {
        socket.close();
      }
    };
  }, [
    appendMessages,
    chatTwitchChannelsKey,
    enableDirectChatSockets,
    kickChannelsKey,
    maxBufferedMessages,
    persistMessages,
    recordStats,
  ]);

  useEffect(() => {
    if (!showStats) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [showStats]);

  useEffect(() => {
    const activeTwitchChannels = chatTwitchChannelsKey
      .split(",")
      .filter(Boolean);

    let active = true;

    async function updateThirdPartyEmotes() {
      try {
        const emotesUrl = new URL("/api/chat-emotes", window.location.origin);

        for (const channel of activeTwitchChannels) {
          emotesUrl.searchParams.append("twitchChannel", channel);
        }

        const response = await fetch(emotesUrl, { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          emotes?: Record<string, ThirdPartyChatEmote>;
        };

        if (active && payload.emotes) {
          setThirdPartyEmotes(payload.emotes);
        }
      } catch {
        if (active) {
          setThirdPartyEmotes((currentEmotes) => currentEmotes);
        }
      }
    }

    updateThirdPartyEmotes();
    const intervalId = window.setInterval(updateThirdPartyEmotes, 15 * 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [chatTwitchChannelsKey]);

  useEffect(() => {
    let active = true;

    async function updateStreamMetrics() {
      try {
        const metricsUrl = new URL("/api/stream-metrics", window.location.origin);
        const activeTwitchChannels = chatTwitchChannelsKey
          .split(",")
          .filter(Boolean);
        const activeKickChannels = kickChannelsKey
          .split(",")
          .filter(Boolean)
          .map((entry) => entry.split(":")[0])
          .filter(Boolean);
        const activeXHandles = xHandlesKey.split(",").filter(Boolean);

        for (const twitchChannel of activeTwitchChannels) {
          metricsUrl.searchParams.append("twitchChannel", twitchChannel);
        }

        for (const kickChannel of activeKickChannels) {
          metricsUrl.searchParams.append("kickChannel", kickChannel);
        }

        for (const xHandle of activeXHandles) {
          metricsUrl.searchParams.append("xHandle", xHandle);
        }

        const response = await fetch(metricsUrl, { cache: "no-store" });
        const data = await response.json();

        if (active) {
          const liveStreamMetrics = {
            kickViewers: Number(data.kickViewers ?? 0),
            totalViewers: Number(data.totalViewers ?? 0),
            twitchViewers: Number(data.twitchViewers ?? 0),
            xViewers: Number(data.xViewers ?? 0),
          };
          const hasLiveMetrics = Boolean(data.online) || liveStreamMetrics.totalViewers > 0;

          setStreamMetrics(
            hasLiveMetrics || !useMockData ? liveStreamMetrics : mockStreamMetrics,
          );
        }
      } catch {
        if (active) {
          setStreamMetrics(useMockData ? mockStreamMetrics : emptyStreamMetrics);
        }
      }
    }

    updateStreamMetrics();
    const intervalId = window.setInterval(updateStreamMetrics, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    chatTwitchChannelsKey,
    kickChannelsKey,
    mockStreamMetrics,
    showStats,
    useMockData,
    xHandlesKey,
  ]);

  useEffect(() => {
    const handles = profileHandlesKey.split(",").filter(Boolean);

    if (handles.length === 0) {
      return;
    }

    let active = true;

    async function updateXProfiles() {
      try {
        const profileUrl = new URL("/api/x-profile", window.location.origin);

        for (const handle of handles) {
          profileUrl.searchParams.append("handle", handle);
        }

        const response = await fetch(profileUrl, { cache: "no-store" });
        const data = await response.json();

        if (!active || !Array.isArray(data.profiles)) {
          return;
        }

        setXProfiles((currentProfiles) => {
          const nextProfiles = { ...currentProfiles };

          for (const profile of data.profiles as XProfile[]) {
            nextProfiles[profile.handle.toLowerCase()] = profile;
          }

          return nextProfiles;
        });
      } catch {
        if (active) {
          setXProfiles((currentProfiles) => currentProfiles);
        }
      }
    }

    updateXProfiles();
    const intervalId = window.setInterval(updateXProfiles, 10 * 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [profileHandlesKey]);

  const tooltipRoot = typeof document === "undefined" ? null : document.body;
  const liveActiveChatters = showStats
    ? Object.values(stats.activeChatters).filter(
        (lastSeenAt) => now - lastSeenAt <= activeWindowMs,
      ).length
    : 0;
  const liveMessagesPerMinute = showStats
    ? stats.messageTimes.filter((messageTime) => now - messageTime <= rateWindowMs).length
    : 0;
  const baselineChatStats = useMockData ? mockChatStats : emptyMockChatStats;
  const displayPlatformCounts: Record<Platform, number> = {
    Kick: baselineChatStats.platformCounts.Kick + stats.platformCounts.Kick,
    Twitch: baselineChatStats.platformCounts.Twitch + stats.platformCounts.Twitch,
    X: baselineChatStats.platformCounts.X + stats.platformCounts.X,
  };
  const displayTotalMessages = Object.values(displayPlatformCounts).reduce(
    (sum, platformCount) => sum + platformCount,
    0,
  );
  const displayPlatformViewers: Record<Platform, number> = {
    Kick: streamMetrics.kickViewers,
    Twitch: streamMetrics.twitchViewers,
    X: streamMetrics.xViewers,
  };
  const displayActiveChatters = baselineChatStats.activeChatters + liveActiveChatters;
  const displayMessagesPerMinute =
    baselineChatStats.messagesPerMinute + liveMessagesPerMinute;
  const chatExpandedStyle =
    chatExpanded && mode !== "popout" && mode !== "embedded"
      ? ({
          animation: "none",
          bottom: "clamp(24px, 3vw, 44px)",
          height: "auto",
          left: "clamp(24px, 3vw, 44px)",
          maxHeight: "none",
          opacity: 1,
          right: "clamp(390px, 30vw, 560px)",
          scale: 1,
          top: "clamp(56px, 5vw, 76px)",
          translate: "0 0",
          width: "auto",
          zIndex: 48,
        } as CSSProperties)
      : undefined;
  const renderChatterRows = (chatters: typeof chatterRows, emptyLabel: string) =>
    chatters.length === 0 ? (
      <div className="chat-chatter-empty">{emptyLabel}</div>
    ) : (
      chatters.map((chatter, index) => (
        <article className="chat-chatter-row" key={chatter.key}>
          <div className="chat-chatter-primary">
            <strong
              className="chat-chatter-author"
              style={{ color: chatter.color ?? getAuthorColor(chatter.author) }}
            >
              {chatter.author}
            </strong>
            <span className="chat-chatter-count">
              {chatter.count} {chatter.count === 1 ? "msg" : "msgs"}
            </span>
          </div>
          <div className="chat-chatter-secondary">
            <span className="chat-chatter-rank">#{index + 1}</span>
            {platforms
              .filter((platform) => chatter.platformCounts[platform] > 0)
              .map((platform) => (
                <span
                  className={`chat-chatter-platform chat-chatter-platform-${platform.toLowerCase()}`}
                  key={platform}
                >
                  <PlatformLogo platform={platform} />
                  {chatter.platformCounts[platform]}
                </span>
              ))}
            <span className="chat-chatter-time">{chatter.lastTime}</span>
          </div>
          <p>{chatter.lastMessage}</p>
        </article>
      ))
    );

  useEffect(() => {
    if (!showStats) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatsNumbersReady(true);
    }, statsIntroDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showStats]);

  return (
    <>
      {mode !== "popout" && mode !== "embedded" ? (
        <div
          className="chat-expanded-backdrop"
          data-expanded={chatExpanded ? "true" : undefined}
          aria-hidden="true"
          onClick={handleExitChatFullscreen}
        />
      ) : null}
      <section
        className="chat-stage"
        data-embedded={mode === "embedded" ? "true" : undefined}
        data-expanded={
          chatExpanded && mode !== "popout" && mode !== "embedded" ? "true" : undefined
        }
        data-popout={mode === "popout" ? "true" : undefined}
        data-paused={paused ? "true" : undefined}
        aria-label="Aggregated live chat"
        onContextMenu={handleChatContextMenu}
        style={chatExpandedStyle}
      >
        <div
          className="chat-feed"
          ref={chatFeedRef}
          onMouseEnter={handleChatFeedMouseEnter}
          onMouseLeave={handleChatFeedMouseLeave}
          onScroll={handleChatScroll}
        >
          {viewMode === "chatters" ? (
            chatterRows.length === 0 ? (
              <div className="chat-empty">
                {normalizedSearchQuery ? "No matching chatters" : "No chatters yet"}
              </div>
            ) : (
              <>
                <section className="chat-chatter-section" aria-labelledby="top-chatters-heading">
                  <header className="chat-chatter-section-header">
                    <h2 className="chat-chatter-section-title" id="top-chatters-heading">
                      Top Chatters
                    </h2>
                    <span className="chat-chatter-section-count">{topChatters.length}/5</span>
                  </header>
                  <div className="chat-chatter-list">
                    {renderChatterRows(topChatters, "No top chatters yet")}
                  </div>
                </section>
                <section
                  className="chat-chatter-section chat-chatter-section-first"
                  aria-labelledby="first-time-chatters-heading"
                >
                  <header className="chat-chatter-section-header">
                    <h2 className="chat-chatter-section-title" id="first-time-chatters-heading">
                      First Time Chatters
                    </h2>
                    <span className="chat-chatter-section-count">
                      {firstTimeChatters.length}
                    </span>
                  </header>
                  <div className="chat-chatter-list">
                    {renderChatterRows(firstTimeChatters, "No first-time chatters yet")}
                  </div>
                </section>
              </>
            )
          ) : null}
          {viewMode === "messages" && visibleMessages.length === 0 && (
            <div className="chat-empty">
              {normalizedSearchQuery
                ? "No matching messages"
                : connected
                  ? "Waiting for chat..."
                  : "Connecting to chat..."}
            </div>
          )}
          {viewMode === "messages" ? renderedMessages.map((message) => (
            <ChatMessageArticle
              enableTickerCards={enableTickerCards}
              key={message.id}
              message={message}
              onPause={pauseChatMessage}
              onResume={resumeChatMessage}
              thirdPartyEmotes={thirdPartyEmotes}
            />
          )) : null}
        </div>
      </section>
      {showStats ? (
        <section
          className="stats-stage"
          aria-label={`Aggregated chat statistics for ${selectedChannelLabel}`}
        >
        <div
          className="channel-switcher"
          role="group"
          aria-label="Stats channel"
          style={channelSwitcherStyle}
        >
          {channelOptions.map((channelOption) => (
            <button
              className="channel-switcher-button"
              data-active={
                channelOption.value === selectedChannelValue ? "true" : undefined
              }
              type="button"
              key={channelOption.value}
              aria-pressed={channelOption.value === selectedChannelValue}
              onMouseEnter={(event) => {
                showProfileTooltip(channelOption, event.clientX, event.clientY);
              }}
              onMouseMove={(event) => {
                showProfileTooltip(channelOption, event.clientX, event.clientY);
              }}
              onMouseLeave={() => {
                setProfileTooltip(null);
              }}
              onFocus={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();

                showProfileTooltip(channelOption, rect.left + rect.width / 2, rect.top);
              }}
              onBlur={() => {
                setProfileTooltip(null);
              }}
              onClick={() => {
                if (channelOption.value !== selectedChannelValue) {
                  onChannelChange(channelOption.value);
                }
              }}
            >
              {channelOption.label}
            </button>
          ))}
        </div>
        <div className="stats-content">
          <dl className="stats-summary">
            <div className="stats-summary-item">
              <dt>Total viewers</dt>
              <dd>
                <AnimatedNumber
                  value={statsNumbersReady ? streamMetrics.totalViewers : 0}
                />
              </dd>
            </div>
            <div className="stats-summary-item">
              <dt>Active chatters</dt>
              <dd>
                <AnimatedNumber
                  value={statsNumbersReady ? displayActiveChatters : 0}
                />
              </dd>
            </div>
            <div className="stats-summary-item">
              <dt>Total messages</dt>
              <dd>
                <AnimatedNumber
                  value={statsNumbersReady ? displayTotalMessages : 0}
                />
              </dd>
            </div>
            <div className="stats-summary-item">
              <dt>Messages / min</dt>
              <dd>
                <AnimatedNumber
                  value={statsNumbersReady ? displayMessagesPerMinute : 0}
                />
              </dd>
            </div>
          </dl>
          <div className="stats-platforms" aria-label="Viewers by platform">
            {platforms.map((platform) => {
              const platformCount = displayPlatformViewers[platform];
              const platformShare =
                streamMetrics.totalViewers === 0
                  ? 0
                  : Math.round((platformCount / streamMetrics.totalViewers) * 100);

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
                  <AnimatedNumber
                    className="stats-platform-count"
                    value={statsNumbersReady ? platformCount : 0}
                  />
                  <AnimatedNumber
                    className="stats-platform-share"
                    suffix="%"
                    value={statsNumbersReady ? platformShare : 0}
                  />
                </div>
                <div
                  className={`stats-platform-bar stats-platform-bar-${platform.toLowerCase()}`}
                  style={
                    {
                      "--platform-share": `${
                        statsNumbersReady ? platformShare : 0
                      }%`,
                    } as CSSProperties
                  }
                />
                </div>
              );
            })}
          </div>
        </div>
        </section>
      ) : null}
      {tooltipRoot && chatExpanded && mode !== "popout"
        ? createPortal(
            <button
              className="chat-fullscreen-button chat-fullscreen-button-screen"
              type="button"
              aria-label="Exit full screen chat"
              title="Exit full screen chat"
              onClick={handleExitChatFullscreen}
            >
              <FiMinimize2 aria-hidden="true" />
            </button>,
            tooltipRoot,
          )
        : null}
      {tooltipRoot && chatContextMenu
        ? createPortal(
            <div
              className="chat-context-menu"
              role="menu"
              style={{ left: chatContextMenu.x, top: chatContextMenu.y }}
            >
              <button
                type="button"
                role="menuitem"
                aria-label={chatExpanded ? "Exit full screen chat" : "Full screen chat"}
                onClick={handleToggleChatFullscreen}
              >
                {chatExpanded ? (
                  <FiMinimize2 aria-hidden="true" />
                ) : (
                  <FiMaximize2 aria-hidden="true" />
                )}
                {chatExpanded ? "Exit full screen" : "Full screen chat"}
              </button>
              <button
                type="button"
                role="menuitem"
                aria-label="Pop out chat"
                onClick={handlePopOutChat}
              >
                <FiExternalLink aria-hidden="true" />
                Pop out chat
              </button>
            </div>,
            tooltipRoot,
          )
        : null}
      {tooltipRoot && profileTooltip
        ? createPortal(
            <div
              className="profile-tooltip"
              style={{ left: profileTooltip.x, top: profileTooltip.y }}
            >
              <ProfileHoverCard
                option={profileTooltip.option}
                profiles={xProfiles}
              />
            </div>,
            tooltipRoot,
          )
        : null}
    </>
  );
}

export const AggregatedChat = memo(AggregatedChatComponent);
