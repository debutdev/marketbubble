"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./MarketTicker.module.css";

type MarketTickerAsset = {
  changePercent: number;
  currency: string | null;
  name: string;
  price: number;
  source: string;
  symbol: string;
  type: "crypto" | "equity" | "commodity" | "index";
};

type MarketTickerResponse = {
  assets: MarketTickerAsset[];
  error?: string;
  fetchedAt?: string;
};

function formatPrice(asset: MarketTickerAsset) {
  const fractionDigits =
    asset.symbol === "DXY" ? 2 : asset.price >= 100 ? 2 : asset.price >= 1 ? 2 : 4;

  if (asset.currency === "USD") {
    return new Intl.NumberFormat(undefined, {
      currency: "USD",
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
      style: "currency",
    }).format(asset.price);
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(asset.price);
}

function formatChange(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function MarketTicker() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [assets, setAssets] = useState<MarketTickerAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadTicker() {
      try {
        const response = await fetch("/api/market-ticker", { cache: "no-store" });
        const payload = (await response.json()) as MarketTickerResponse;

        if (!active) {
          return;
        }

        if (!response.ok || !payload.assets.length) {
          setError(payload.error ?? "Market data unavailable.");
          setIsLoading(false);
          return;
        }

        setAssets(payload.assets);
        setError(null);
        setIsLoading(false);
      } catch {
        if (active) {
          setError("Market data unavailable.");
          setIsLoading(false);
        }
      }
    }

    loadTicker();
    const intervalId = window.setInterval(loadTicker, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useLayoutEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollLeft = 0;
    }
  }, [assets]);

  return (
    <section className={styles.shell} aria-label="Market ticker">
      <div className={styles.scroll} key="fixed-market-ticker-grid" ref={scrollerRef}>
        {isLoading ? (
          Array.from({ length: 11 }).map((_, index) => (
            <div className={`${styles.item} ${styles.loadingItem}`} key={index}>
              <span />
              <span />
              <span />
            </div>
          ))
        ) : error && !assets.length ? (
          <div className={styles.status}>{error}</div>
        ) : (
          assets.map((asset) => {
            const tone =
              asset.changePercent > 0
                ? "positive"
                : asset.changePercent < 0
                  ? "negative"
                  : "flat";

            return (
              <article
                className={styles.item}
                data-tone={tone}
                key={`${asset.symbol}-${asset.source}`}
                title={`${asset.name} - ${asset.source}`}
              >
                <strong className={styles.symbol}>{asset.symbol}</strong>
                <span className={styles.price}>{formatPrice(asset)}</span>
                <em className={styles.change}>{formatChange(asset.changePercent)}</em>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
