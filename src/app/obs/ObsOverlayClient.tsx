/* eslint-disable @next/next/no-img-element */
"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AggregatedChat } from "@/components/AggregatedChat";
import { channelOptions, getChannelOption } from "@/lib/channel-options";
import type { OverlayKind, OverlaySettings } from "./overlay-settings";
import styles from "./obs.module.css";

type NewsItem = {
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

type NewsResponse = {
  error?: string;
  fetchedAt?: string;
  items: NewsItem[];
};

type MarketCategory = "crypto" | "ai" | "tech" | "finance";

type PolymarketMarket = {
  categories: MarketCategory[];
  closesAt: string | null;
  dayChange?: number;
  id: string;
  image: string | null;
  liquidity: number;
  primaryCategory: MarketCategory;
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

type PolymarketResponse = {
  error?: string;
  fetchedAt?: string;
  markets: PolymarketMarket[];
};

const defaultPollMs = 25_000;
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

function haveSameIds<T extends { id: string }>(first: T[] | undefined, second: T[] | undefined) {
  if (!first || !second || first.length !== second.length) {
    return false;
  }

  return first.every((item, index) => item.id === second[index]?.id);
}

function haveSameMarkets(
  first: PolymarketMarket[] | undefined,
  second: PolymarketMarket[] | undefined,
) {
  if (!first || !second || first.length !== second.length) {
    return false;
  }

  return first.every((market, index) => {
    const nextMarket = second[index];

    return (
      nextMarket &&
      market.id === nextMarket.id &&
      market.question === nextMarket.question &&
      market.probability?.label === nextMarket.probability?.label &&
      market.probability?.value === nextMarket.probability?.value &&
      market.volume24h === nextMarket.volume24h
    );
  });
}

function getTweetAvatarUrl(handle: string | undefined) {
  if (!handle) {
    return null;
  }

  return `https://unavatar.io/twitter/${encodeURIComponent(handle)}`;
}

function getNewsAvatarUrl(item: NewsItem) {
  if (item.avatar) {
    return item.avatar;
  }

  if (item.kind === "tweet") {
    return getTweetAvatarUrl(item.handle);
  }

  return getTweetAvatarUrl(newsSourceAvatarHandles[item.source] ?? item.handle);
}

function formatFeedTime(timestamp: number) {
  const elapsedMs = Date.now() - timestamp;

  if (elapsedMs < 60_000) {
    return "now";
  }

  if (elapsedMs < 3_600_000) {
    return `${Math.max(1, Math.round(elapsedMs / 60_000))}m`;
  }

  if (elapsedMs < 86_400_000) {
    return `${Math.max(1, Math.round(elapsedMs / 3_600_000))}h`;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(timestamp));
}

function formatMarketDate(value: string | null) {
  if (!value) {
    return "TBA";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function formatCompactMoney(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "$0";
  }

  return new Intl.NumberFormat(undefined, {
    compactDisplay: "short",
    currency: "USD",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
    notation: "compact",
    style: "currency",
  }).format(value);
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getMarketYesValue(probability: PolymarketMarket["probability"]) {
  if (!probability) {
    return null;
  }

  const probabilityValue = clampPercentage(probability.value);

  return probability.label.toLowerCase() === "no"
    ? 100 - probabilityValue
    : probabilityValue;
}

function getShellClassName(kind: OverlayKind) {
  return [
    styles.shell,
    kind === "chat" ? styles.chatShell : "",
    kind === "news" ? styles.newsShell : "",
    kind === "polymarket" ? styles.polymarketShell : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function useOverlayDocumentClass() {
  useEffect(() => {
    document.documentElement.classList.add("obs-overlay-root");
    document.body.classList.add("obs-overlay-body");

    return () => {
      document.documentElement.classList.remove("obs-overlay-root");
      document.body.classList.remove("obs-overlay-body");
    };
  }, []);
}

function useNews(limit: number) {
  const [payload, setPayload] = useState<NewsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function updateNews() {
      try {
        const response = await fetch("/api/watch-newswire", { cache: "no-store" });
        const nextPayload = (await response.json()) as NewsResponse;

        if (!active) {
          return;
        }

        setPayload((currentPayload) =>
          haveSameIds(currentPayload?.items, nextPayload.items)
            ? currentPayload
            : nextPayload,
        );
        setError(response.ok ? nextPayload.error ?? null : nextPayload.error ?? "Unable to load news.");
      } catch {
        if (active) {
          setError("Unable to load news.");
        }
      }
    }

    updateNews();
    const intervalId = window.setInterval(updateNews, defaultPollMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    error,
    items: (payload?.items ?? []).slice(0, limit),
  };
}

function usePolymarket(limit: number) {
  const [payload, setPayload] = useState<PolymarketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function updateMarkets() {
      try {
        const response = await fetch("/api/polymarket-markets", { cache: "no-store" });
        const nextPayload = (await response.json()) as PolymarketResponse;

        if (!active) {
          return;
        }

        setPayload((currentPayload) =>
          haveSameMarkets(currentPayload?.markets, nextPayload.markets)
            ? currentPayload
            : nextPayload,
        );
        setError(
          response.ok
            ? nextPayload.error ?? null
            : nextPayload.error ?? "Unable to load markets.",
        );
      } catch {
        if (active) {
          setError("Unable to load markets.");
        }
      }
    }

    updateMarkets();
    const intervalId = window.setInterval(updateMarkets, defaultPollMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    error,
    markets: (payload?.markets ?? []).slice(0, limit),
  };
}

function useChatConfig(settings: OverlaySettings) {
  return useMemo(() => {
    return {
      options: channelOptions,
      selected: getChannelOption(settings.source),
    };
  }, [settings.source]);
}

function OverlayChrome({
  children,
  framed,
  title,
}: {
  children: ReactNode;
  framed: boolean;
  title: string;
}) {
  return (
    <section className={framed ? styles.panel : styles.unframedPanel} aria-label={title}>
      <header className={styles.panelHeader}>
        <span aria-hidden="true" />
        <strong>{title}</strong>
      </header>
      {children}
    </section>
  );
}

function ChatOverlay({ settings }: { settings: OverlaySettings }) {
  const { options, selected } = useChatConfig(settings);

  return (
    <div className={styles.chatOverlay}>
      <AggregatedChat
        channelOptions={options}
        enablePopout={false}
        enableTickerCards
        maxMessagesPerPlatform={Math.max(40, settings.limit)}
        messageRenderLimit={settings.limit}
        mode="embedded"
        monitoredSources={selected}
        onChannelChange={() => {}}
        selectedChannelValue={selected.value}
        showStats={false}
        useMockData={settings.mock}
        visiblePlatforms={settings.platforms}
      />
    </div>
  );
}

function NewsOverlay({ settings }: { settings: OverlaySettings }) {
  const { error, items } = useNews(settings.limit);

  return (
    <OverlayChrome framed={settings.framed} title="Live News">
      <div className={styles.newsList}>
        {items.map((item) => {
          const avatarUrl = getNewsAvatarUrl(item);

          return (
            <a
              className={styles.newsCard}
              href={item.url}
              key={item.id}
              rel="noreferrer"
              target="_blank"
            >
              <span className={styles.newsAvatar}>
                {avatarUrl ? (
                  <img alt="" src={avatarUrl} />
                ) : (
                  <span>{item.source.slice(0, 1)}</span>
                )}
              </span>
              <span className={styles.newsContent}>
                <span className={styles.newsMeta}>
                  <strong>{item.name}</strong>
                  <time dateTime={new Date(item.ts).toISOString()}>
                    {formatFeedTime(item.ts)}
                  </time>
                </span>
                <span className={styles.newsSource}>
                  {item.kind === "tweet" && item.handle ? `@${item.handle}` : item.source}
                </span>
                <span className={styles.newsText}>{item.text}</span>
              </span>
            </a>
          );
        })}
        {items.length === 0 ? (
          <div className={styles.status}>{error ?? "Loading news..."}</div>
        ) : null}
      </div>
    </OverlayChrome>
  );
}

function PolymarketOverlay({ settings }: { settings: OverlaySettings }) {
  const { error, markets } = usePolymarket(settings.limit);

  return (
    <OverlayChrome framed={settings.framed} title="Live Polymarket">
      <div className={styles.marketList}>
        {markets.map((market) => {
          const yesValue = getMarketYesValue(market.probability);
          const noValue = yesValue === null ? null : 100 - yesValue;
          const barStyle = {
            "--yes-share": `${yesValue ?? 50}%`,
          } as CSSProperties;

          return (
            <a
              className={styles.marketCard}
              data-category={market.primaryCategory}
              href={market.url}
              key={`${market.id}-${market.url}`}
              rel="noreferrer"
              style={barStyle}
              target="_blank"
            >
              <span className={styles.marketTopline}>
                <span>Closes {formatMarketDate(market.closesAt)}</span>
                <span>{formatCompactMoney(market.volume24h)} 24h</span>
              </span>
              <strong>{market.question}</strong>
              <span className={styles.marketBar} aria-hidden="true">
                <span />
                <span />
              </span>
              <span className={styles.marketOdds}>
                <span>Yes {yesValue === null ? "--" : `${Math.round(yesValue)}%`}</span>
                <span>No {noValue === null ? "--" : `${Math.round(noValue)}%`}</span>
              </span>
            </a>
          );
        })}
        {markets.length === 0 ? (
          <div className={styles.status}>{error ?? "Loading markets..."}</div>
        ) : null}
      </div>
    </OverlayChrome>
  );
}

export function ObsOverlayClient({
  kind,
  settings,
}: {
  kind: OverlayKind;
  settings: OverlaySettings;
}) {
  useOverlayDocumentClass();

  return (
    <main
      className={getShellClassName(kind)}
      data-framed={settings.framed ? "true" : undefined}
      aria-label={`Market Bubble OBS ${kind} overlay`}
    >
      {kind === "chat" ? <ChatOverlay settings={settings} /> : null}
      {kind === "news" ? <NewsOverlay settings={settings} /> : null}
      {kind === "polymarket" ? <PolymarketOverlay settings={settings} /> : null}
    </main>
  );
}
