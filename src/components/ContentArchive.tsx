/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { FiExternalLink, FiFilm, FiMessageCircle, FiPlayCircle } from "react-icons/fi";
import { SiX } from "react-icons/si";
import styles from "./ContentArchive.module.css";

type MarketTweet = {
  author: string;
  id: string;
  isRetweet: boolean;
  media: string[];
  publishedAt: string;
  text: string;
  title: string;
  url: string;
};

type XFeedResponse = {
  error?: string;
  fetchedAt?: string;
  handle: string;
  tweets: MarketTweet[];
};

type TwitchVideo = {
  creator: string;
  durationSeconds: number;
  game: string;
  id: string;
  publishedAt: string | null;
  thumbnailUrl: string;
  title: string;
  url: string;
  viewCount: number;
};

type TwitchVideosResponse = {
  error?: string;
  fetchedAt?: string;
  videos: TwitchVideo[];
};

function formatDate(value: string | undefined) {
  if (!value) {
    return "Live";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    compactDisplay: "short",
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
    notation: "compact",
  }).format(value);
}

function getToneClass(index: number) {
  return index % 4 === 0 ? styles.tweetWide : index % 5 === 0 ? styles.tweetTall : "";
}

export function ContentArchive() {
  const [feed, setFeed] = useState<XFeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streams, setStreams] = useState<TwitchVideo[] | null>(null);
  const [streamsError, setStreamsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadContent() {
      try {
        const [feedResponse, streamsResponse] = await Promise.all([
          fetch("/api/x-feed?handle=MarketBubble", { cache: "no-store" }),
          fetch("/api/twitch-videos?channel=fazebanks&limit=5", { cache: "no-store" }),
        ]);
        const payload = (await feedResponse.json()) as XFeedResponse;
        const streamsPayload = (await streamsResponse.json()) as TwitchVideosResponse;

        if (!active) {
          return;
        }

        setFeed(payload);
        setError(feedResponse.ok ? null : payload.error ?? "Unable to load Market Bubble content.");
        setStreams(streamsPayload.videos ?? []);
        setStreamsError(
          streamsResponse.ok ? null : streamsPayload.error ?? "Unable to load recent streams.",
        );
      } catch {
        if (active) {
          setError("Unable to load Market Bubble content.");
          setStreams([]);
          setStreamsError("Unable to load recent streams.");
        }
      }
    }

    loadContent();

    return () => {
      active = false;
    };
  }, []);

  const tweets = useMemo(() => feed?.tweets ?? [], [feed?.tweets]);
  const clips = useMemo(
    () => tweets.filter((tweet) => tweet.media.length > 0).slice(0, 8),
    [tweets],
  );

  if (!feed && !error) {
    return (
      <section className={styles.shell} aria-label="Market Bubble content feed">
        <div className={styles.sidePanel}>
          <div className={styles.skeletonTitle} />
          {Array.from({ length: 5 }).map((_, index) => (
            <div className={styles.skeletonLine} key={index} />
          ))}
        </div>
        <div className={styles.mainPanel}>
          {Array.from({ length: 8 }).map((_, index) => (
            <div className={styles.skeletonCard} key={index} />
          ))}
        </div>
        <div className={styles.clipPanel}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div className={styles.skeletonClip} key={index} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.shell} aria-label="Market Bubble content feed">
      <aside className={styles.sidePanel} aria-label="Content overview">
        <header className={styles.panelHeader}>
          <h1>Content</h1>
          <span>@MarketBubble</span>
        </header>
        <dl className={styles.metrics}>
          <div>
            <dt>Posts</dt>
            <dd>{tweets.length}</dd>
          </div>
          <div>
            <dt>Media</dt>
            <dd>{clips.length}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatDate(feed?.fetchedAt)}</dd>
          </div>
        </dl>
        <a
          className={styles.profileLink}
          href="https://x.com/MarketBubble"
          rel="noreferrer"
          target="_blank"
        >
          <SiX aria-hidden="true" />
          Open X Profile
          <FiExternalLink aria-hidden="true" />
        </a>
        <section className={styles.streamSection} aria-label="Recent FaZeBanks streams">
          <header className={styles.streamHeader}>
            <h2>Recent Streams</h2>
            <span>FaZeBanks</span>
          </header>
          <div className={styles.streamList}>
            {(streams ?? []).map((stream) => (
              <a
                className={styles.streamItem}
                href={stream.url}
                key={stream.id}
                rel="noreferrer"
                target="_blank"
              >
                <span className={styles.streamThumb}>
                  {stream.thumbnailUrl ? <img alt="" loading="lazy" src={stream.thumbnailUrl} /> : null}
                  <span>
                    <FiPlayCircle aria-hidden="true" />
                  </span>
                </span>
                <span className={styles.streamCopy}>
                  <strong>{stream.title}</strong>
                  <em>
                    {formatDate(stream.publishedAt ?? undefined)} · {formatDuration(stream.durationSeconds)}
                  </em>
                  <span>
                    {stream.game} · {formatCompactNumber(stream.viewCount)} views
                  </span>
                </span>
              </a>
            ))}
            {streams === null ? <div className={styles.streamStatus}>Loading recent streams</div> : null}
            {streams !== null && streams.length === 0 ? (
              <div className={styles.streamStatus}>
                {streamsError ?? "No recent streams available."}
              </div>
            ) : null}
          </div>
        </section>
      </aside>

      <section className={styles.mainPanel} aria-label="@MarketBubble tweets">
        <header className={styles.panelHeader}>
          <h2>Latest Tweets</h2>
          <span>{feed?.fetchedAt ? `Updated ${formatDate(feed.fetchedAt)}` : "Live"}</span>
        </header>
        <div className={styles.tweetGrid}>
          {tweets.map((tweet, index) => (
            <a
              className={[styles.tweetCard, getToneClass(index), tweet.media[0] ? styles.hasMedia : ""]
                .filter(Boolean)
                .join(" ")}
              href={tweet.url}
              key={tweet.id}
              rel="noreferrer"
              target="_blank"
            >
              {tweet.media[0] ? (
                <img alt="" className={styles.tweetImage} loading="lazy" src={tweet.media[0]} />
              ) : null}
              <span className={styles.cardShade} aria-hidden="true" />
              <span className={styles.cardGlow} aria-hidden="true" />
              <span className={styles.cardContent}>
                <span className={styles.cardTop}>
                  <span>
                    <SiX aria-hidden="true" />
                    {tweet.author}
                  </span>
                  <time dateTime={tweet.publishedAt}>{formatDate(tweet.publishedAt)}</time>
                </span>
                <span className={styles.cardCopy}>
                  {tweet.isRetweet ? <span className={styles.badge}>Retweeted</span> : null}
                  <strong>{tweet.text}</strong>
                </span>
              </span>
            </a>
          ))}
          {!tweets.length ? (
            <div className={styles.status}>
              <FiMessageCircle aria-hidden="true" />
              {error ?? "No posts available."}
            </div>
          ) : null}
        </div>
      </section>

      <aside className={styles.clipPanel} aria-label="Market Bubble clips and media">
        <header className={styles.panelHeader}>
          <h2>Clips</h2>
          <span>{clips.length} media posts</span>
        </header>
        <div className={styles.clipList}>
          {clips.map((tweet, index) => (
            <a
              className={styles.clipCard}
              href={tweet.url}
              key={`${tweet.id}-${index}`}
              rel="noreferrer"
              target="_blank"
            >
              <span className={styles.clipThumb}>
                <img alt="" loading="lazy" src={tweet.media[0]} />
                <span>
                  <FiFilm aria-hidden="true" />
                </span>
              </span>
              <span className={styles.clipCopy}>
                <strong>{tweet.text}</strong>
                <em>{formatDate(tweet.publishedAt)}</em>
              </span>
            </a>
          ))}
          {!clips.length ? (
            <div className={styles.status}>
              <FiFilm aria-hidden="true" />
              {error ?? "No media posts available."}
            </div>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
