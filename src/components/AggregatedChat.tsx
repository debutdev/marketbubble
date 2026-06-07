"use client";

import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiCheckCircle,
  FiExternalLink,
  FiMaximize2,
  FiMinimize2,
} from "react-icons/fi";
import { SiKick, SiTwitch, SiX } from "react-icons/si";
import { AnimatedNumber } from "@/components/AnimatedNumber";

const kickPusherUrl =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false";
const maxMessages = 100;
const activeWindowMs = 5 * 60 * 1000;
const rateWindowMs = 60 * 1000;
const statsIntroDelayMs = 4320;
const platforms: Platform[] = ["Twitch", "Kick", "X"];
const platformLogoColors: Record<Platform, string> = {
  Kick: "#53fc18",
  Twitch: "#9146ff",
  X: "#e4e4e4",
};
const authorColors = [
  "#a970ff",
  "#ff7a9a",
  "#45d483",
  "#4fa7ff",
  "#ffb347",
  "#72e0d1",
  "#d889ff",
  "#ff6f61",
  "#c7e85f",
  "#7aa7ff",
  "#f0d35f",
  "#ff8fd6",
];

type ChatMessage = {
  id: string;
  platform: Platform;
  author: string;
  authorColor?: string;
  text: string;
  time: string;
};

type Platform = "Twitch" | "Kick" | "X";

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

const defaultMockChatStats: MockChatStats = {
  activeChatters: 1620,
  messagesPerMinute: 520,
  platformCounts: {
    Kick: 52600,
    Twitch: 1180,
    X: 18000,
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

function parseTwitchMessage(line: string): ChatMessage | null {
  const match = line.match(/^:([^!]+)![^ ]+ PRIVMSG #([^ ]+) :(.*)$/);

  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  return {
    id: `${match[2]}-${Date.now()}-${Math.random()}`,
    platform: "Twitch",
    author: match[1],
    text: match[3],
    time: formatMessageTime(new Date()),
  };
}

function parseKickMessage(rawData: string): ChatMessage | null {
  try {
    const data = JSON.parse(rawData);

    if (!data?.sender?.username || !data?.content) {
      return null;
    }

    return {
      id: data.id ?? `${Date.now()}-${Math.random()}`,
      platform: "Kick",
      author: data.sender.username,
      authorColor: data.sender.identity?.color,
      text: normalizeKickMessage(data.content),
      time: formatMessageTime(data.created_at ? new Date(data.created_at) : new Date()),
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
    time: formatMessageTime(new Date()),
  };
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

function PlatformLogo({ platform }: { platform: Platform }) {
  if (platform === "Kick") {
    return <SiKick aria-hidden="true" />;
  }

  if (platform === "X") {
    return <SiX aria-hidden="true" />;
  }

  return <SiTwitch aria-hidden="true" />;
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

type AggregatedChatProps = {
  channelOptions: ChannelOption[];
  enablePopout?: boolean;
  mode?: "default" | "popout";
  monitoredSources: SourceSet;
  onChannelChange: (channelValue: string) => void;
  selectedChannelValue: string;
  showStats?: boolean;
};

export function AggregatedChat({
  channelOptions,
  enablePopout = true,
  mode = "default",
  monitoredSources,
  onChannelChange,
  selectedChannelValue,
  showStats = true,
}: AggregatedChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(mockRecordedAt);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState<ChatStats>(() =>
    createInitialChatStats(mockChatMessages),
  );
  const [streamMetrics, setStreamMetrics] = useState<StreamMetrics>(() =>
    getMockStreamMetrics(selectedChannelValue),
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
  const [xProfiles, setXProfiles] = useState<Record<string, XProfile>>({});
  const pausedRef = useRef(false);
  const bufferedMessagesRef = useRef<ChatMessage[]>([]);
  const chatFeedRef = useRef<HTMLDivElement | null>(null);
  const hoverPausedRef = useRef(false);
  const contextMenuPausedRef = useRef(false);
  const mockMessageIndexRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const scrollPausedRef = useRef(false);
  const scrollResumeTimeoutRef = useRef<number | null>(null);
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

  const appendMessages = useCallback((incomingMessages: ChatMessage[]) => {
    setMessages((currentMessages) =>
      [...currentMessages, ...incomingMessages].slice(-maxMessages),
    );
  }, []);

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
  }, []);

  const pauseChat = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resumeChat = useCallback(() => {
    if (
      hoverPausedRef.current ||
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

  useEffect(() => {
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
        ].slice(-maxMessages);
        return;
      }

      appendMessages(messagesToEmit);
    }, 720);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appendMessages, recordStats, selectedChannelValue]);

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
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (scrollResumeTimeoutRef.current !== null) {
        window.clearTimeout(scrollResumeTimeoutRef.current);
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
    if (!chatExpanded || mode === "popout") {
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

        if (incomingMessages.length === 0) {
          return;
        }

        recordStats(incomingMessages);

        if (pausedRef.current) {
          bufferedMessagesRef.current = [
            ...bufferedMessagesRef.current,
            ...incomingMessages,
          ].slice(-maxMessages);
          return;
        }

        appendMessages(incomingMessages);
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

        recordStats([kickMessage]);

        if (pausedRef.current) {
          bufferedMessagesRef.current = [
            ...bufferedMessagesRef.current,
            kickMessage,
          ].slice(-maxMessages);
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
  }, [appendMessages, chatTwitchChannelsKey, kickChannelsKey, recordStats]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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

          setStreamMetrics(hasLiveMetrics ? liveStreamMetrics : mockStreamMetrics);
        }
      } catch {
        if (active) {
          setStreamMetrics(mockStreamMetrics);
        }
      }
    }

    updateStreamMetrics();
    const intervalId = window.setInterval(updateStreamMetrics, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [chatTwitchChannelsKey, kickChannelsKey, mockStreamMetrics, xHandlesKey]);

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
  const liveActiveChatters = Object.values(stats.activeChatters).filter(
    (lastSeenAt) => now - lastSeenAt <= activeWindowMs,
  ).length;
  const liveMessagesPerMinute = stats.messageTimes.filter(
    (messageTime) => now - messageTime <= rateWindowMs,
  ).length;
  const displayPlatformCounts: Record<Platform, number> = {
    Kick: mockChatStats.platformCounts.Kick + stats.platformCounts.Kick,
    Twitch: mockChatStats.platformCounts.Twitch + stats.platformCounts.Twitch,
    X: mockChatStats.platformCounts.X + stats.platformCounts.X,
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
  const displayActiveChatters = mockChatStats.activeChatters + liveActiveChatters;
  const displayMessagesPerMinute =
    mockChatStats.messagesPerMinute + liveMessagesPerMinute;
  const chatExpandedStyle =
    chatExpanded && mode !== "popout"
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setStatsNumbersReady(true);
    }, statsIntroDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      {mode !== "popout" ? (
        <div
          className="chat-expanded-backdrop"
          data-expanded={chatExpanded ? "true" : undefined}
          aria-hidden="true"
          onClick={handleExitChatFullscreen}
        />
      ) : null}
      <section
        className="chat-stage"
        data-expanded={chatExpanded && mode !== "popout" ? "true" : undefined}
        data-popout={mode === "popout" ? "true" : undefined}
        data-paused={paused ? "true" : undefined}
        aria-label="Aggregated live chat"
        onContextMenu={handleChatContextMenu}
        style={chatExpandedStyle}
      >
        <div className="chat-feed" ref={chatFeedRef} onScroll={handleChatScroll}>
          {messages.length === 0 && (
            <div className="chat-empty">
              {connected ? "Waiting for chat..." : "Connecting to chat..."}
            </div>
          )}
          {messages.map((message) => (
            <article
              className="chat-message"
              key={message.id}
              tabIndex={0}
              onMouseEnter={() => {
                hoverPausedRef.current = true;
                pauseChat();
              }}
              onMouseLeave={() => {
                hoverPausedRef.current = false;
                resumeChat();
              }}
              onFocus={() => {
                hoverPausedRef.current = true;
                pauseChat();
              }}
              onBlur={() => {
                hoverPausedRef.current = false;
                resumeChat();
              }}
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
                </span>
              </div>
              <p>{message.text}</p>
            </article>
          ))}
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
