"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type CryptoSentiment = {
  classification: string;
  sourceName: string;
  sourceUrl: string;
  timestamp: number | null;
  value: number;
};

function formatIndexDate(value: number | null) {
  if (!value) {
    return "Latest";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function getSentimentTone(value: number) {
  if (value <= 24) {
    return "extreme-fear";
  }

  if (value <= 44) {
    return "fear";
  }

  if (value <= 55) {
    return "neutral";
  }

  if (value <= 75) {
    return "greed";
  }

  return "extreme-greed";
}

export function CryptoFearGreedCard() {
  const [sentiment, setSentiment] = useState<CryptoSentiment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSentiment() {
      try {
        const response = await fetch("/api/crypto-sentiment", {
          cache: "no-store",
        });
        const payload = (await response.json()) as CryptoSentiment & { error?: string };

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError(payload.error ?? "Crypto sentiment unavailable.");
          return;
        }

        setSentiment(payload);
        setError(null);
      } catch {
        if (active) {
          setError("Crypto sentiment unavailable.");
        }
      }
    }

    loadSentiment();

    return () => {
      active = false;
    };
  }, []);

  if (error && !sentiment) {
    return (
      <aside className="crypto-fear-greed-card" aria-label="Crypto Fear and Greed Index">
        <span>Crypto Fear &amp; Greed</span>
        <strong>Offline</strong>
        <div className="crypto-fear-greed-meta">
          <span>{error}</span>
        </div>
      </aside>
    );
  }

  if (!sentiment) {
    return (
      <aside className="crypto-fear-greed-card crypto-fear-greed-card-loading" aria-label="Crypto Fear and Greed Index">
        <span>Crypto Fear &amp; Greed</span>
        <strong>--</strong>
        <div className="crypto-fear-greed-meter" aria-hidden="true">
          <span />
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="crypto-fear-greed-card"
      data-tone={getSentimentTone(sentiment.value)}
      aria-label="Crypto Fear and Greed Index"
      style={{ "--fear-greed-score": `${sentiment.value}%` } as CSSProperties}
    >
      <span>Crypto Fear &amp; Greed</span>
      <div className="crypto-fear-greed-score">
        <strong>{sentiment.value}</strong>
        <span>{sentiment.classification}</span>
      </div>
      <div className="crypto-fear-greed-meter" aria-hidden="true">
        <span />
      </div>
      <div className="crypto-fear-greed-meta">
        <span>{formatIndexDate(sentiment.timestamp)}</span>
        <a href={sentiment.sourceUrl} rel="noreferrer" target="_blank">
          {sentiment.sourceName}
        </a>
      </div>
    </aside>
  );
}
