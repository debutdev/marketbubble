/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { FiExternalLink } from "react-icons/fi";

type CategoryKey = "crypto" | "ai" | "tech" | "finance";

type PolymarketMarket = {
  categories: CategoryKey[];
  closesAt: string | null;
  id: string;
  image: string | null;
  liquidity: number;
  primaryCategory: CategoryKey;
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

type PolymarketMarketsResponse = {
  error?: string;
  fetchedAt?: string;
  markets: PolymarketMarket[];
};

function formatCurrency(value: number) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }

  return `$${Math.round(value)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Open";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function formatProbability(value: number) {
  if (value > 0 && value < 1) {
    return "<1%";
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function getBentoClassName(index: number) {
  const layoutClasses = ["", "polymarket-market-card-wide", "", "", "", "polymarket-market-card-wide"];

  return [
    "polymarket-market-card",
    index === 0 ? "polymarket-market-card-featured" : layoutClasses[index % layoutClasses.length],
  ]
    .filter(Boolean)
    .join(" ");
}

export function PolymarketMarketsGrid() {
  const [data, setData] = useState<PolymarketMarketsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMarkets() {
      try {
        const response = await fetch("/api/polymarket-markets", {
          cache: "no-store",
        });
        const payload = (await response.json()) as PolymarketMarketsResponse;

        if (!active) {
          return;
        }

        setData(payload);
        setError(response.ok ? null : payload.error ?? "Unable to load markets.");
      } catch {
        if (active) {
          setError("Unable to load markets.");
        }
      }
    }

    loadMarkets();

    return () => {
      active = false;
    };
  }, []);

  const markets = data?.markets ?? [];

  if (error && !data?.markets.length) {
    return <div className="polymarket-markets-status">{error}</div>;
  }

  if (!data) {
    return (
      <div className="polymarket-market-grid polymarket-market-grid-loading">
        {Array.from({ length: 12 }).map((_, index) => (
          <div className={getBentoClassName(index)} key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="polymarket-markets-wrap">
      <div className="polymarket-market-grid" aria-label="Polymarket markets">
        {markets.map((market, index) => (
          <a
            className={getBentoClassName(index)}
            data-category={market.primaryCategory}
            href={market.url}
            key={`${market.id}-${market.url}`}
            rel="noreferrer"
            target="_blank"
          >
            {market.image ? <img alt="" className="polymarket-market-image" src={market.image} /> : null}
            <span className="polymarket-market-shade" aria-hidden="true" />
            <div className="polymarket-market-content">
              <div className="polymarket-market-top">
                <span className="polymarket-market-category">{market.primaryCategory}</span>
                <span>{formatCurrency(market.volume24h)} 24h</span>
              </div>

              <div className="polymarket-market-main">
                <h2>{market.question}</h2>
                {market.probability ? (
                  <div className="polymarket-market-probability">
                    <span>{formatProbability(market.probability.value)}</span>
                    <span>{market.probability.label}</span>
                  </div>
                ) : null}
              </div>

              <div className="polymarket-market-footer">
                <span>{formatCurrency(market.liquidity)} liquidity</span>
                <span>{formatDate(market.closesAt)}</span>
                <FiExternalLink aria-hidden="true" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
