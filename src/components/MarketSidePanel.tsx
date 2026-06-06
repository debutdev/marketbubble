"use client";

import { useEffect, useId, useState } from "react";
import styles from "./MarketSidePanel.module.css";

type MarketRow = {
  changePercent: number;
  name: string;
  price: number;
  symbol: string;
  trend?: number[];
};

type MarketAssetDetail = {
  asset: {
    description: string;
    name: string;
    ticker: string;
  };
  chart: Array<{
    close: number;
    time: string;
  }>;
  changePercent: number | null;
  currency: string;
  fetchedAt: string;
  news: Array<{
    publishedAt: string | null;
    source: string;
    title: string;
    url: string;
  }>;
  price: number | null;
};

type MarketTickerResponse = {
  globalMarkets?: {
    commodities: MarketRow[];
    crypto: MarketRow[];
    stockIndices: MarketRow[];
  };
};

const cryptoIconUrls: Record<string, string> = {
  BTC: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/bitcoin/default.svg",
  ETH: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/ethereum/default.svg",
  HYPE: "https://cdn.brandfetch.io/idGSMNVeGY/w/270/h/270/theme/dark/icon.png?c=1bxid64Mup7aczewSAYMX&t=1768327356373",
  SOL: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/solana/default.svg",
};

function formatPrice(value: number) {
  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatChange(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
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

function getLineChartPaths(values: number[]) {
  if (values.length < 2) {
    return { areaPath: "", linePath: "" };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 28 - ((value - min) / range) * 24;

    return { x, y };
  });

  const linePath = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }

    const previous = points[index - 1];
    const controlX = ((previous.x + point.x) / 2).toFixed(1);

    return `${path} C ${controlX} ${previous.y.toFixed(1)}, ${controlX} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, "");

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} 31 L ${firstPoint.x.toFixed(1)} 31 Z`;

  return { areaPath, linePath };
}

function DetailChart({ points, tone }: { points: MarketAssetDetail["chart"]; tone: "positive" | "negative" }) {
  const closes = points.map((point) => point.close);
  const { areaPath, linePath } = getLineChartPaths(closes);
  const gradientId = `market-detail-area-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-label="Recent price chart"
      className={styles.detailChart}
      data-tone={tone}
      role="img"
      viewBox="0 0 100 32"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop className={styles.areaStopStrong} offset="0%" />
          <stop className={styles.areaStopFade} offset="100%" />
        </linearGradient>
      </defs>
      {areaPath ? <path className={styles.sparklineArea} d={areaPath} fill={`url(#${gradientId})`} /> : null}
      {linePath ? <path className={styles.sparklineLine} d={linePath} /> : null}
    </svg>
  );
}

function MiniLineChart({ row }: { row: MarketRow }) {
  const gradientId = `market-line-area-${useId().replace(/:/g, "")}`;
  const { areaPath, linePath } = getLineChartPaths(row.trend ?? []);
  const tone = row.changePercent >= 0 ? "positive" : "negative";
  const accessibilityLabel = `${row.name} 24 hour trend with current change ${formatChange(row.changePercent)}.`;

  return (
    <svg
      aria-label={accessibilityLabel}
      className={styles.sparkline}
      data-tone={tone}
      role="img"
      viewBox="0 0 100 32"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop className={styles.areaStopStrong} offset="0%" />
          <stop className={styles.areaStopFade} offset="100%" />
        </linearGradient>
      </defs>
      {areaPath ? <path className={styles.sparklineArea} d={areaPath} fill={`url(#${gradientId})`} /> : null}
      {linePath ? <path className={styles.sparklineLine} d={linePath} /> : null}
    </svg>
  );
}

function MarketSection({
  onSelect,
  rows,
  title,
  withIcons = false,
}: {
  onSelect: (row: MarketRow) => void;
  rows: MarketRow[];
  title: string;
  withIcons?: boolean;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <span>{title}</span>
        <span>Price</span>
        <span>24h</span>
        <span>Trend</span>
      </div>
      <div className={styles.rows}>
        {rows.map((row) => {
          const tone = row.changePercent >= 0 ? "positive" : "negative";

          return (
            <button
              className={styles.row}
              key={row.symbol}
              onClick={() => onSelect(row)}
              title={`Open ${row.name} details`}
              type="button"
            >
              <div className={styles.asset}>
                {withIcons ? (
                  <span
                    aria-hidden="true"
                    className={styles.cryptoIcon}
                    data-symbol={row.symbol}
                    style={{ backgroundImage: `url("${cryptoIconUrls[row.symbol] ?? ""}")` }}
                  />
                ) : null}
                <strong>{row.name}</strong>
              </div>
              <span className={styles.price}>{formatPrice(row.price)}</span>
              <span className={styles.change} data-tone={tone}>
                {formatChange(row.changePercent)}
              </span>
              <MiniLineChart row={row} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MarketAssetDialog({
  asset,
  onClose,
}: {
  asset: MarketRow;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<MarketAssetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tone = (details?.changePercent ?? asset.changePercent) >= 0 ? "positive" : "negative";
  const titleId = useId();
  const chartPoints = details?.chart?.length
    ? details.chart
    : (asset.trend ?? []).map((close, index) => ({
        close,
        time: String(index),
      }));

  useEffect(() => {
    let active = true;

    async function loadDetails() {
      setDetails(null);
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          name: asset.name,
          symbol: asset.symbol,
        });
        const response = await fetch(`/api/market-asset?${searchParams.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as MarketAssetDetail;

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError("Market details unavailable.");
          return;
        }

        setDetails(payload);
      } catch {
        if (active) {
          setError("Market details unavailable.");
        }
      }
    }

    loadDetails();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      active = false;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [asset.name, asset.symbol, onClose]);

  return (
    <div className={styles.dialogBackdrop} onMouseDown={onClose}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.dialog}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.dialogHeader}>
          <div>
            <span>{details?.asset.ticker ?? asset.symbol}</span>
            <h3 id={titleId}>{details?.asset.name ?? asset.name}</h3>
          </div>
          <button aria-label="Close market details" onClick={onClose} type="button">
            Close
          </button>
        </header>

        <div className={styles.dialogStats}>
          <strong>{formatPrice(details?.price ?? asset.price)}</strong>
          <span data-tone={tone}>{formatChange(details?.changePercent ?? asset.changePercent)}</span>
        </div>

        <DetailChart points={chartPoints} tone={tone} />

        <p className={styles.description}>
          {details?.asset.description ?? "Loading description and recent market context."}
        </p>

        <section className={styles.newsPanel} aria-label="Recent news">
          <h4>Recent News</h4>
          <div className={styles.newsList}>
            {details?.news.map((item) => (
              <a href={item.url} key={`${item.source}-${item.title}`} rel="noreferrer" target="_blank">
                <strong>{item.title}</strong>
                <span>
                  {item.source} · {formatNewsTime(item.publishedAt)}
                </span>
              </a>
            ))}
            {details && !details.news.length ? <div className={styles.dialogStatus}>No recent news found.</div> : null}
            {!details ? <div className={styles.dialogStatus}>{error ?? "Loading market details"}</div> : null}
          </div>
        </section>
      </section>
    </div>
  );
}

export function MarketSidePanel() {
  const [commodities, setCommodities] = useState<MarketRow[]>([]);
  const [crypto, setCrypto] = useState<MarketRow[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<MarketRow | null>(null);
  const [stockIndices, setStockIndices] = useState<MarketRow[]>([]);

  useEffect(() => {
    let active = true;

    async function loadMarkets() {
      try {
        const response = await fetch("/api/market-ticker", { cache: "no-store" });
        const payload = (await response.json()) as MarketTickerResponse;

        if (!active) {
          return;
        }

        setCommodities(payload.globalMarkets?.commodities ?? []);
        setCrypto(payload.globalMarkets?.crypto ?? []);
        setStockIndices(payload.globalMarkets?.stockIndices ?? []);
      } catch {
        if (active) {
          setCommodities([]);
          setCrypto([]);
          setStockIndices([]);
        }
      }
    }

    loadMarkets();
    const intervalId = window.setInterval(loadMarkets, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <>
      <aside className={styles.shell} aria-label="Global Markets">
        <div className={styles.viewport}>
          <h2>Global Markets</h2>
          <MarketSection onSelect={setSelectedAsset} rows={stockIndices} title="Stock Indices" />
          <MarketSection onSelect={setSelectedAsset} rows={crypto} title="Crypto" withIcons />
          <MarketSection onSelect={setSelectedAsset} rows={commodities} title="Commodities" />
        </div>
      </aside>
      {selectedAsset ? <MarketAssetDialog asset={selectedAsset} onClose={() => setSelectedAsset(null)} /> : null}
    </>
  );
}
