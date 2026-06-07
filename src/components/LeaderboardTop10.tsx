/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { FiArrowUpRight } from "react-icons/fi";
import { Spinner } from "@/components/Spinner";
import styles from "./LeaderboardTop10.module.css";

type CtSignal = {
  overview: string;
  signal: "bullish" | "bearish";
};

type CtMember = {
  avatarUrl: string | null;
  description: string;
  followers: number;
  handle: string;
  name: string;
  profileUrl: string;
  rank: number;
  recentTweets: string[];
  signal: CtSignal;
  tag?: string;
  verified: boolean;
};

type CtLeaderboardResponse = {
  error?: string;
  fetchedAt?: string;
  members: CtMember[];
  signalModel: string | null;
  signalSource: "openrouter" | "local-fallback";
};

function formatFollowers(value: number) {
  if (!value) {
    return "CT";
  }

  return new Intl.NumberFormat(undefined, {
    compactDisplay: "short",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
    notation: "compact",
  }).format(value);
}

function formatUpdatedAt(value?: string) {
  if (!value) {
    return "Live";
  }

  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));

  if (seconds < 60) {
    return `Updated ${seconds}s ago`;
  }

  return `Updated ${Math.round(seconds / 60)}m ago`;
}

function initials(member: CtMember) {
  return member.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || member.handle.slice(0, 2).toUpperCase();
}

export function LeaderboardTop10() {
  const [payload, setPayload] = useState<CtLeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLeaderboard() {
      try {
        const response = await fetch("/api/ct-leaderboard", { cache: "no-store" });
        const nextPayload = (await response.json()) as CtLeaderboardResponse;

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError(nextPayload.error ?? "CT leaderboard unavailable.");
          return;
        }

        setPayload(nextPayload);
        setError(null);
      } catch {
        if (active) {
          setError("CT leaderboard unavailable.");
        }
      }
    }

    loadLeaderboard();
    const intervalId = window.setInterval(loadLeaderboard, 30 * 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const members = useMemo(
    () => [...(payload?.members ?? [])].sort((a, b) => a.rank - b.rank),
    [payload?.members],
  );

  return (
    <section className={styles.shell} aria-label="MarketBubble top 10 CT list">
      <section className={styles.boardPanel} aria-label="Top 10 CT cards">
        <header className={styles.panelHeader}>
          <h1>MarketBubble&apos;s Top 10 of CT</h1>
          <span>{payload ? `${payload.signalSource === "openrouter" ? "Grok" : "Local"} / ${formatUpdatedAt(payload.fetchedAt)}` : "Loading"}</span>
        </header>
        <div className={styles.cardGrid}>
          {members.map((member) => (
            <article className={styles.card} data-tone={member.signal.signal} key={member.handle}>
              <div className={styles.media}>
                {member.avatarUrl ? (
                  <img alt="" loading="lazy" src={member.avatarUrl} />
                ) : (
                  <span className={styles.avatarFallback}>{initials(member)}</span>
                )}
                <span className={styles.overlay} aria-hidden="true" />
                <span className={styles.rankLabel}>
                  #{member.rank}
                  <i aria-hidden="true" />
                </span>
                <span className={styles.pin}>
                  {member.tag ?? formatFollowers(member.followers)}
                  <i aria-hidden="true" />
                </span>
              </div>
              <div className={styles.content}>
                <div className={styles.identity}>
                  <strong>{member.name}</strong>
                  <span>
                    @{member.handle}
                    {member.verified ? " / verified" : ""}
                  </span>
                </div>
                <p>{member.description || "Crypto Twitter signal account."}</p>
                <div className={styles.signal}>
                  <span>{member.signal.signal}</span>
                  <em>{member.signal.overview}</em>
                </div>
                <small>{member.recentTweets.length ? `${member.recentTweets.length} recent tweets analyzed` : "Recent tweets unavailable"}</small>
                <a className={styles.action} href={member.profileUrl} rel="noreferrer" target="_blank">
                  Open X
                  <FiArrowUpRight aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
          {!members.length ? (
            <div className={styles.status}>
              <Spinner aria-hidden="true" size={18} />
              {error ?? "Loading CT leaderboard"}
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
