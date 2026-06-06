/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { SiX } from "react-icons/si";

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

function formatTweetDate(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function getBentoClassName(index: number, hasMedia: boolean) {
  const layoutClasses = ["", "market-tweet-card-wide", "", "", "", "market-tweet-card-wide"];

  return [
    "market-tweet-card",
    index === 0 ? "market-tweet-card-featured" : layoutClasses[index % layoutClasses.length],
    hasMedia ? "market-tweet-card-with-media" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function MarketTweetsGrid() {
  const [feed, setFeed] = useState<XFeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFeed() {
      try {
        const response = await fetch("/api/x-feed?handle=MarketBubble", {
          cache: "no-store",
        });
        const data = (await response.json()) as XFeedResponse;

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError(data.error ?? "Unable to load @MarketBubble posts.");
          setFeed(data);
          return;
        }

        setFeed(data);
        setError(null);
      } catch {
        if (active) {
          setError("Unable to load @MarketBubble posts.");
        }
      }
    }

    loadFeed();

    return () => {
      active = false;
    };
  }, []);

  if (error && !feed?.tweets.length) {
    return (
      <div className="market-tweets-status">
        <SiX aria-hidden="true" />
        <span>{error}</span>
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="market-tweets-grid market-tweets-grid-loading" aria-label="Loading posts">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="market-tweet-card market-tweet-card-loading" key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="market-tweets-wrap">
      <div className="market-tweets-meta">
        <span>{feed.tweets.length} latest posts</span>
        {feed.fetchedAt ? <span>Updated {formatTweetDate(feed.fetchedAt)}</span> : null}
      </div>
      <div className="market-tweets-grid" aria-label="@MarketBubble posts">
        {feed.tweets.map((tweet, index) => (
          <a
            className={getBentoClassName(index, Boolean(tweet.media[0]))}
            href={tweet.url}
            key={tweet.id}
            rel="noreferrer"
            target="_blank"
          >
            {tweet.media[0] ? (
              <img
                alt=""
                className="market-tweet-media"
                loading="lazy"
                src={tweet.media[0]}
              />
            ) : null}
            <span className="market-tweet-card-shade" aria-hidden="true" />
            <span className="market-tweet-card-glow" aria-hidden="true" />
            <div className="market-tweet-card-content">
              <div className="market-tweet-card-top">
                <span className="market-tweet-source">
                  <SiX aria-hidden="true" />
                  {tweet.author}
                </span>
                <span>{formatTweetDate(tweet.publishedAt)}</span>
              </div>
              <div className="market-tweet-card-copy">
                {tweet.isRetweet ? <span className="market-tweet-badge">Retweeted</span> : null}
                <p>{tweet.text}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
