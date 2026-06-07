/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  FiExternalLink,
  FiFilm,
  FiMaximize2,
  FiMinimize2,
  FiMessageCircle,
  FiPause,
  FiPlay,
  FiPlayCircle,
  FiVolume2,
  FiVolumeX,
  FiX,
} from "react-icons/fi";
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

type ClipVideoResponse = {
  aspectRatio?: number[] | null;
  durationMs?: number | null;
  error?: string;
  posterUrl?: string;
  tweetId?: string;
  videoUrl?: string;
};

const twitchParents = ["127.0.0.1", "localhost", "marketbubble.vercel.app"];

function getTwitchVideoEmbedSrc(videoId: string) {
  const parentParams = twitchParents.map((parent) => `parent=${encodeURIComponent(parent)}`).join("&");

  return `https://player.twitch.tv/?video=${encodeURIComponent(videoId)}&${parentParams}&muted=true&autoplay=true`;
}

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

function getStatusId(tweet: MarketTweet) {
  return tweet.id || (tweet.url.match(/status\/(\d+)/)?.[1] ?? "");
}

function isLikelyVideoClip(tweet: MarketTweet) {
  return (
    tweet.media.some((url) => /(?:amplify_video_thumb|ext_tw_video_thumb|video_thumb)/i.test(url)) ||
    /\nVideo\s*$/i.test(tweet.text)
  );
}

function getClipCopy(tweet: MarketTweet) {
  return tweet.text.replace(/\n+Video\s*$/i, "").trim();
}

function getClipTitle(tweet: MarketTweet) {
  const title = (tweet.title || getClipCopy(tweet))
    .replace(/^RT by @MarketBubble:\s*/i, "")
    .split("\n")
    .find(Boolean);

  return title?.trim() || "Market Bubble clip";
}

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getToneClass(index: number) {
  return index % 4 === 0 ? styles.tweetWide : index % 5 === 0 ? styles.tweetTall : "";
}

export function ContentArchive() {
  const playerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [feed, setFeed] = useState<XFeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streams, setStreams] = useState<TwitchVideo[] | null>(null);
  const [streamsError, setStreamsError] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<MarketTweet | null>(null);
  const [selectedStream, setSelectedStream] = useState<TwitchVideo | null>(null);
  const [clipVideo, setClipVideo] = useState<ClipVideoResponse | null>(null);
  const [clipVideoError, setClipVideoError] = useState<string | null>(null);
  const [clipVideoLoading, setClipVideoLoading] = useState(false);
  const [clipCurrentTime, setClipCurrentTime] = useState(0);
  const [clipDuration, setClipDuration] = useState(0);
  const [clipFullscreen, setClipFullscreen] = useState(false);
  const [clipMuted, setClipMuted] = useState(false);
  const [clipPlaying, setClipPlaying] = useState(false);
  const [clipVolume, setClipVolume] = useState(1);

  useEffect(() => {
    if (!selectedClip && !selectedStream) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedClip(null);
        setSelectedStream(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.removeProperty("overflow");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedClip, selectedStream]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setClipFullscreen(document.fullscreenElement === playerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!selectedClip) {
      return;
    }

    const controller = new AbortController();
    const statusId = getStatusId(selectedClip);

    async function loadClipVideo() {
      try {
        const response = await fetch(`/api/x-video?id=${encodeURIComponent(statusId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as ClipVideoResponse;

        if (controller.signal.aborted) {
          return;
        }

        if (!response.ok || !payload.videoUrl) {
          setClipVideoError(payload.error ?? "Clip video unavailable.");
          setClipVideo(null);

          return;
        }

        setClipVideo(payload);
        setClipDuration((payload.durationMs ?? 0) / 1000);
      } catch {
        if (!controller.signal.aborted) {
          setClipVideoError("Clip video unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setClipVideoLoading(false);
        }
      }
    }

    loadClipVideo();

    return () => {
      controller.abort();
    };
  }, [selectedClip]);

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
    () => tweets.filter((tweet) => tweet.media.length > 0 && isLikelyVideoClip(tweet)).slice(0, 8),
    [tweets],
  );
  const clipProgress = clipDuration > 0 ? Math.min((clipCurrentTime / clipDuration) * 100, 100) : 0;
  const playerRangeStyle = { "--clip-progress": `${clipProgress}%` } as CSSProperties;

  function openClip(tweet: MarketTweet) {
    setClipCurrentTime(0);
    setClipDuration(0);
    setClipPlaying(false);
    setClipVideo(null);
    setClipVideoError(null);
    setClipVideoLoading(true);
    setSelectedClip(tweet);
    setSelectedStream(null);
  }

  function closeClip() {
    videoRef.current?.pause();
    setClipPlaying(false);
    setSelectedClip(null);
  }

  function openStream(stream: TwitchVideo) {
    videoRef.current?.pause();
    setClipPlaying(false);
    setSelectedClip(null);
    setSelectedStream(stream);
  }

  function closeStream() {
    setSelectedStream(null);
  }

  async function toggleClipPlayback() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      try {
        await video.play();
      } catch {
        setClipVideoError("Clip playback unavailable.");
      }

      return;
    }

    video.pause();
  }

  function seekClip(value: string) {
    const nextTime = Number(value);
    const video = videoRef.current;

    setClipCurrentTime(nextTime);

    if (video) {
      video.currentTime = nextTime;
    }
  }

  function setPlayerVolume(value: string) {
    const nextVolume = Number(value);
    const video = videoRef.current;

    setClipVolume(nextVolume);
    setClipMuted(nextVolume <= 0);

    if (video) {
      video.volume = nextVolume;
      video.muted = nextVolume <= 0;
    }
  }

  function toggleClipMute() {
    const video = videoRef.current;
    const nextMuted = !clipMuted;
    const nextVolume = !nextMuted && clipVolume <= 0 ? 0.8 : clipVolume;

    setClipMuted(nextMuted);
    setClipVolume(nextVolume);

    if (video) {
      video.muted = nextMuted;
      video.volume = nextVolume;
    }
  }

  async function toggleClipFullscreen() {
    if (!playerRef.current) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();

      return;
    }

    await playerRef.current.requestFullscreen();
  }

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
              <button
                className={styles.streamItem}
                key={stream.id}
                onClick={() => openStream(stream)}
                type="button"
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
              </button>
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
          <span>{clips.length} clips</span>
        </header>
        <div className={styles.clipList}>
          {clips.map((tweet, index) => (
            <button
              className={styles.clipCard}
              key={`${tweet.id}-${index}`}
              onClick={() => openClip(tweet)}
              type="button"
            >
              <span className={styles.clipThumb}>
                <img alt="" loading="lazy" src={tweet.media[0]} />
                <span>
                  <FiFilm aria-hidden="true" />
                </span>
              </span>
              <span className={styles.clipCopy}>
                <strong>{getClipTitle(tweet)}</strong>
                <em>{formatDate(tweet.publishedAt)}</em>
              </span>
            </button>
          ))}
          {!clips.length ? (
            <div className={styles.status}>
              <FiFilm aria-hidden="true" />
              {error ?? "No media posts available."}
            </div>
          ) : null}
        </div>
      </aside>
      {selectedClip ? (
        <div className={styles.clipDialogLayer} role="presentation">
          <button
            aria-label="Close clip viewer"
            className={styles.clipDialogBackdrop}
            onClick={closeClip}
            type="button"
          />
          <section
            aria-label={`${getClipTitle(selectedClip)} clip viewer`}
            aria-modal="true"
            className={styles.clipDialog}
            role="dialog"
          >
            <header className={styles.clipDialogHeader}>
              <div>
                <span>Market Bubble Clip</span>
                <h2>{getClipTitle(selectedClip)}</h2>
              </div>
              <button
                aria-label="Close clip viewer"
                onClick={closeClip}
                type="button"
              >
                <FiX aria-hidden="true" />
              </button>
            </header>
            <div className={styles.clipDialogBody}>
              <div className={styles.clipVideoWrap} ref={playerRef}>
                {clipVideo?.videoUrl ? (
                  <div className={styles.clipPlayer}>
                    <video
                      className={styles.clipVideo}
                      onClick={toggleClipPlayback}
                      onEnded={() => setClipPlaying(false)}
                      onLoadedMetadata={(event) => {
                        const duration = event.currentTarget.duration;

                        setClipDuration(Number.isFinite(duration) ? duration : (clipVideo.durationMs ?? 0) / 1000);
                      }}
                      onPause={() => setClipPlaying(false)}
                      onPlay={() => setClipPlaying(true)}
                      onTimeUpdate={(event) => setClipCurrentTime(event.currentTarget.currentTime)}
                      playsInline
                      poster={clipVideo.posterUrl || selectedClip.media[0]}
                      preload="metadata"
                      ref={videoRef}
                      src={clipVideo.videoUrl}
                    />
                    <button
                      aria-label={clipPlaying ? "Pause clip" : "Play clip"}
                      className={styles.playerHitArea}
                      onClick={toggleClipPlayback}
                      type="button"
                    >
                      {!clipPlaying ? (
                        <span className={styles.playerCenterButton}>
                          <FiPlay aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                    <div className={styles.playerControls}>
                      <button
                        aria-label={clipPlaying ? "Pause clip" : "Play clip"}
                        className={styles.playerIconButton}
                        onClick={toggleClipPlayback}
                        type="button"
                      >
                        {clipPlaying ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />}
                      </button>
                      <span className={styles.playerTime}>
                        {formatPlaybackTime(clipCurrentTime)} / {formatPlaybackTime(clipDuration)}
                      </span>
                      <input
                        aria-label="Seek clip"
                        className={styles.playerTimeline}
                        max={clipDuration || 0}
                        min="0"
                        onChange={(event) => seekClip(event.currentTarget.value)}
                        step="0.1"
                        style={playerRangeStyle}
                        type="range"
                        value={Math.min(clipCurrentTime, clipDuration || 0)}
                      />
                      <button
                        aria-label={clipMuted ? "Unmute clip" : "Mute clip"}
                        className={styles.playerIconButton}
                        onClick={toggleClipMute}
                        type="button"
                      >
                        {clipMuted || clipVolume <= 0 ? (
                          <FiVolumeX aria-hidden="true" />
                        ) : (
                          <FiVolume2 aria-hidden="true" />
                        )}
                      </button>
                      <input
                        aria-label="Clip volume"
                        className={styles.playerVolume}
                        max="1"
                        min="0"
                        onChange={(event) => setPlayerVolume(event.currentTarget.value)}
                        step="0.05"
                        type="range"
                        value={clipMuted ? 0 : clipVolume}
                      />
                      <button
                        aria-label={clipFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                        className={styles.playerIconButton}
                        onClick={toggleClipFullscreen}
                        type="button"
                      >
                        {clipFullscreen ? (
                          <FiMinimize2 aria-hidden="true" />
                        ) : (
                          <FiMaximize2 aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.clipVideoPlaceholder}>
                    {selectedClip.media[0] ? <img alt="" src={selectedClip.media[0]} /> : null}
                    <span>{clipVideoLoading ? "Loading clip" : clipVideoError ?? "Clip unavailable"}</span>
                  </div>
                )}
              </div>
              <aside className={styles.clipDialogInfo}>
                <div>
                  <span>Posted</span>
                  <strong>{formatDate(selectedClip.publishedAt)}</strong>
                </div>
                <div>
                  <span>Source</span>
                  <strong>{selectedClip.author}</strong>
                </div>
                <p>{getClipCopy(selectedClip)}</p>
                <a href={selectedClip.url} rel="noreferrer" target="_blank">
                  Open on X
                  <FiExternalLink aria-hidden="true" />
                </a>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
      {selectedStream ? (
        <div className={styles.clipDialogLayer} role="presentation">
          <button
            aria-label="Close stream viewer"
            className={styles.clipDialogBackdrop}
            onClick={closeStream}
            type="button"
          />
          <section
            aria-label={`${selectedStream.title} stream viewer`}
            aria-modal="true"
            className={styles.clipDialog}
            role="dialog"
          >
            <header className={styles.clipDialogHeader}>
              <div>
                <span>FaZeBanks Stream</span>
                <h2>{selectedStream.title}</h2>
              </div>
              <button aria-label="Close stream viewer" onClick={closeStream} type="button">
                <FiX aria-hidden="true" />
              </button>
            </header>
            <div className={styles.clipDialogBody}>
              <div className={styles.clipVideoWrap}>
                <iframe
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className={styles.streamEmbed}
                  src={getTwitchVideoEmbedSrc(selectedStream.id)}
                  title={`${selectedStream.title} Twitch replay`}
                />
              </div>
              <aside className={styles.clipDialogInfo}>
                <div>
                  <span>Streamed</span>
                  <strong>{formatDate(selectedStream.publishedAt ?? undefined)}</strong>
                </div>
                <div>
                  <span>Runtime</span>
                  <strong>{formatDuration(selectedStream.durationSeconds)}</strong>
                </div>
                <div>
                  <span>Category</span>
                  <strong>{selectedStream.game}</strong>
                </div>
                <p>
                  {selectedStream.title}
                  {"\n\n"}
                  {formatCompactNumber(selectedStream.viewCount)} views on Twitch.
                </p>
                <a href={selectedStream.url} rel="noreferrer" target="_blank">
                  Open on Twitch
                  <FiExternalLink aria-hidden="true" />
                </a>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
