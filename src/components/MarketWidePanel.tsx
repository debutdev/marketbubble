"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { fetchCachedJson, getCachedJson } from "@/lib/client-json-cache";
import styles from "./MarketWidePanel.module.css";

type NewsItem = {
  impact: number;
  imageUrl: string;
  publishedAt: string | null;
  source: string;
  sourceLogoUrl: string;
  tone: "bullish" | "bearish";
  title: string;
  url: string;
};

type MarketNarrativeResponse = {
  error?: string;
  fetchedAt?: string;
  news: NewsItem[];
};

type HeatmapMode = "stock" | "crypto";

const marketNarrativeUrl = "/api/market-narrative";
const marketNarrativeTtlMs = 90_000;

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

function formatNewsTime(value: string | null) {
  if (!value) {
    return "Live";
  }

  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.round(minutes / 60)}h ago`;
}

function TradingViewHeatmap({ mode }: { mode: HeatmapMode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.async = true;
    script.src =
      mode === "stock"
        ? "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js"
        : "https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js";
    script.type = "text/javascript";
    script.text = JSON.stringify(
      mode === "stock"
        ? {
            blockColor: "change",
            blockSize: "market_cap_basic",
            colorTheme: "dark",
            dataSource: "SPX500",
            exchanges: [],
            grouping: "sector",
            hasSymbolTooltip: true,
            hasTopBar: false,
            height: "100%",
            isDataSetEnabled: false,
            isMonoSize: false,
            isZoomEnabled: true,
            locale: "en",
            symbolUrl: "",
            width: "100%",
          }
        : {
            blockColor: "24h_close_change|5",
            blockSize: "market_cap_calc",
            colorTheme: "dark",
            dataSource: "Crypto",
            hasSymbolTooltip: true,
            hasTopBar: false,
            height: "100%",
            isDataSetEnabled: false,
            isMonoSize: false,
            isZoomEnabled: true,
            locale: "en",
            symbolUrl: "",
            width: "100%",
          },
    );

    container.appendChild(widget);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [mode]);

  return (
    <div
      aria-label={`TradingView ${mode} market heatmap`}
      className={`tradingview-widget-container ${styles.tradingViewHeatmap}`}
      key={mode}
      ref={containerRef}
    />
  );
}

export function MarketWidePanel() {
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("crypto");
  const cachedPayload = getCachedJson<MarketNarrativeResponse>(marketNarrativeUrl);
  const [payload, setPayload] = useState<MarketNarrativeResponse | null>(() => cachedPayload);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadNarratives() {
      try {
        const { ok, payload: nextPayload } = await fetchCachedJson<MarketNarrativeResponse>(
          marketNarrativeUrl,
          marketNarrativeTtlMs,
        );

        if (!active) {
          return;
        }

        if (!ok) {
          setError(nextPayload.error ?? "Narrative data unavailable.");
          return;
        }

        setPayload(nextPayload);
        setError(null);
      } catch {
        if (active) {
          setError("Narrative data unavailable.");
        }
      }
    }

    loadNarratives();
    const intervalId = window.setInterval(loadNarratives, 90_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const news = payload?.news ?? [];

  return (
    <section
      aria-label="Market Narrative Monitor"
      className={styles.shell}
    >
      <div className={styles.viewport}>
        <header className={styles.header}>
          <h2>Market Narrative Monitor</h2>
          <span>{formatUpdatedAt(payload?.fetchedAt)}</span>
        </header>

        <section className={styles.heatmap} aria-label="Market heat map">
          <div className={styles.heatmapControls} role="tablist" aria-label="Heatmap type">
            <button
              aria-selected={heatmapMode === "crypto"}
              onClick={() => setHeatmapMode("crypto")}
              role="tab"
              type="button"
            >
              Crypto
            </button>
            <button
              aria-selected={heatmapMode === "stock"}
              onClick={() => setHeatmapMode("stock")}
              role="tab"
              type="button"
            >
              Stocks
            </button>
          </div>
          <TradingViewHeatmap mode={heatmapMode} />
        </section>

        <section className={styles.news} aria-label="News intelligence feed">
          <div className={styles.newsHeader}>
            <h3>News Intelligence Feed</h3>
          </div>
          <div className={styles.newsList}>
            {news.slice(0, 4).map((item) => (
              <a className={styles.newsItem} href={item.url} key={`${item.source}-${item.title}`} rel="noreferrer" target="_blank">
                <span className={styles.newsIcon}>
                  <span
                    aria-hidden="true"
                    className={styles.newsIconImage}
                    style={{ "--news-image": `url("${item.imageUrl || item.sourceLogoUrl}")` } as CSSProperties}
                  />
                </span>
                <span className={styles.newsCopy}>
                  <strong>{item.title}</strong>
                  <em>
                    {item.source} · {formatNewsTime(item.publishedAt)}
                  </em>
                </span>
                <span className={styles.newsTone} data-tone={item.tone}>
                  <em>News</em>
                  {item.tone}
                </span>
              </a>
            ))}
            {!news.length ? <div className={styles.status}>{error ?? "Loading news"}</div> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
