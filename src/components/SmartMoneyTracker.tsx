"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { fetchCachedJson, getCachedJson } from "@/lib/client-json-cache";
import styles from "./SmartMoneyTracker.module.css";

type SmartTrader = {
  address: string;
  grade: string;
  mainToken: string | null;
  name: string;
  pnl30d: number;
  pnl30dPercent: number;
  positions: number;
  rank: number;
  trades: number;
  winRate: number;
};

type SmartPortfolio = {
  filingDate: string | null;
  holdings: Array<{
    changePercent: number | null;
    issuer: string;
    ticker: string;
    value: number;
    weight: number;
  }>;
  label: string;
  manager: string;
  performance: number;
};

type SmartMarket = {
  changePercent: number;
  no: number | null;
  question: string;
  url: string;
  volume: number;
  volume24h: number;
  yes: number | null;
};

type SmartMoneyResponse = {
  error?: string;
  fetchedAt?: string;
  hyperliquid: {
    lastUpdated: string | null;
    traders: SmartTrader[];
  };
  polymarketMarkets: SmartMarket[];
  portfolios: SmartPortfolio[];
};

const smartMoneyUrl = "/api/smart-money";
const smartMoneyTtlMs = 120_000;

function formatCompactUsd(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 1_000_000_000) {
    return `${sign}$${(absolute / 1_000_000_000).toFixed(2)}B`;
  }

  if (absolute >= 1_000_000) {
    return `${sign}$${(absolute / 1_000_000).toFixed(2)}M`;
  }

  if (absolute >= 1_000) {
    return `${sign}$${(absolute / 1_000).toFixed(1)}K`;
  }

  return `${sign}$${absolute.toFixed(0)}`;
}

function formatPercent(value: number, decimals = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

function formatUpdatedAt(value?: string) {
  if (!value) {
    return "";
  }

  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));

  if (seconds < 60) {
    return `Updated ${seconds}s ago`;
  }

  return `Updated ${Math.round(seconds / 60)}m ago`;
}

function getSparklinePoints(seed: number, positive = true) {
  const points = Array.from({ length: 15 }, (_, index) => {
    const wave = Math.sin(index * 1.4 + seed) * 0.32;
    const noise = Math.cos(index * 2.1 + seed * 0.7) * 0.16;
    return (positive ? index * 0.13 : -index * 0.08) + wave + noise;
  });
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 24 - ((point - min) / range) * 20;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function MiniSparkline({ positive, seed }: { positive: boolean; seed: number }) {
  return (
    <svg aria-hidden="true" className={styles.sparkline} data-tone={positive ? "positive" : "negative"} viewBox="0 0 100 28">
      <polyline points={getSparklinePoints(seed, positive)} />
    </svg>
  );
}

function PortfolioRing({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, 62 + value * 8));

  return (
    <span
      aria-hidden="true"
      className={styles.ring}
      style={{ "--ring-value": `${normalized}%` } as CSSProperties}
    >
      <span>{Math.round(normalized)}%</span>
    </span>
  );
}

export function SmartMoneyTracker() {
  const cachedPayload = getCachedJson<SmartMoneyResponse>(smartMoneyUrl);
  const [payload, setPayload] = useState<SmartMoneyResponse | null>(() => cachedPayload);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSmartMoney() {
      try {
        const { ok, payload: nextPayload } = await fetchCachedJson<SmartMoneyResponse>(
          smartMoneyUrl,
          smartMoneyTtlMs,
        );

        if (!active) {
          return;
        }

        if (!ok) {
          setError(nextPayload.error ?? "Smart money data unavailable.");
          return;
        }

        setPayload(nextPayload);
        setError(null);
      } catch {
        if (active) {
          setError("Smart money data unavailable.");
        }
      }
    }

    loadSmartMoney();
    const intervalId = window.setInterval(loadSmartMoney, 120_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const traders = payload?.hyperliquid.traders ?? [];
  const portfolios = payload?.portfolios ?? [];
  const markets = payload?.polymarketMarkets ?? [];

  return (
    <section aria-label="Smart Money Tracker" className={styles.shell}>
      <div className={styles.viewport}>
        <header className={styles.header}>
          <h2>Smart Money Tracker</h2>
          <span>{formatUpdatedAt(payload?.fetchedAt)}</span>
        </header>

        <section
          className={`${styles.third} ${styles.tradersSection}`}
          aria-label="Top Hyperliquid traders"
        >
          <div className={styles.sectionHeader}>
            <h3>Top Hyperliquid Traders</h3>
          </div>
          <div className={styles.traderHeader}>
            <span>Rank</span>
            <span>Trader</span>
            <span>PNL 30D</span>
            <span>Win</span>
            <span>Trend</span>
          </div>
          <div className={styles.traderList}>
            {traders.map((trader, index) => (
              <a
                className={styles.traderRow}
                href={`https://hyperstats.org/wallet/${trader.address}`}
                key={trader.address || trader.rank}
                rel="noreferrer"
                target="_blank"
              >
                <span>{index + 1}</span>
                <strong>
                  {trader.name}
                  <em>{trader.grade || trader.mainToken || "HL"}</em>
                </strong>
                <span className={trader.pnl30d >= 0 ? styles.positive : styles.negative}>
                  {formatCompactUsd(trader.pnl30d)}
                </span>
                <span>{trader.winRate.toFixed(0)}%</span>
                <MiniSparkline positive={trader.pnl30d >= 0} seed={trader.rank || index} />
              </a>
            ))}
            {!traders.length ? <div className={styles.status}>{error ?? "Loading Hyperliquid traders"}</div> : null}
          </div>
        </section>

        <section
          className={`${styles.third} ${styles.portfoliosSection}`}
          aria-label="Influential portfolios"
        >
          <div className={styles.sectionHeader}>
            <h3>Influential Portfolios</h3>
            <span>13F</span>
          </div>
          <div className={styles.portfolios}>
            {portfolios.map((portfolio) => (
              <article className={styles.portfolioCard} key={portfolio.manager}>
                <strong>{portfolio.label}</strong>
                <PortfolioRing value={portfolio.performance} />
                <span className={portfolio.performance >= 0 ? styles.positive : styles.negative}>
                  {formatPercent(portfolio.performance)}
                </span>
                <em>{portfolio.holdings.map((holding) => holding.ticker).join(" / ")}</em>
              </article>
            ))}
            {!portfolios.length ? <div className={styles.status}>{error ?? "Loading portfolio filings"}</div> : null}
          </div>
        </section>

        <section
          className={`${styles.third} ${styles.marketsSection}`}
          aria-label="Top Polymarket markets by volume"
        >
          <div className={styles.sectionHeader}>
            <h3>Top Polymarket Volume</h3>
          </div>
          <div className={styles.marketList}>
            {markets.map((market, index) => (
              <a className={styles.marketRow} href={market.url} key={market.url} rel="noreferrer" target="_blank">
                <strong>{market.question}</strong>
                <span>
                  <em>Yes</em>
                  {market.yes ?? "--"}%
                </span>
                <span>
                  <em>No</em>
                  {market.no ?? "--"}%
                </span>
                <span>
                  <em>Vol</em>
                  {formatCompactUsd(market.volume24h || market.volume)}
                </span>
                <MiniSparkline positive={market.changePercent >= 0} seed={index + 3} />
              </a>
            ))}
            {!markets.length ? <div className={styles.status}>{error ?? "Loading Polymarket markets"}</div> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
