import type { Metadata } from "next";
import Image from "next/image";
import { TopTextNav } from "@/components/TopTextNav";
import { ScheduleCountdown } from "./ScheduleCountdown";
import styles from "./schedule.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Schedule | Market Bubble",
  description: "Market Bubble show schedule and latest Spotify episodes.",
};

type SpotifyImageSource = {
  height?: number;
  maxHeight?: number;
  maxWidth?: number;
  url?: string;
  width?: number;
};

type SpotifyEpisodeData = {
  coverArt?: {
    sources?: SpotifyImageSource[];
  };
  description?: string;
  duration?: {
    totalMilliseconds?: number;
  };
  id?: string;
  mediaTypes?: string[];
  name?: string;
  previewPlayback?: {
    audioPreview?: {
      cdnUrl?: string;
    };
  };
  releaseDate?: {
    isoString?: string;
  };
  uri?: string;
  videoPreviewThumbnail?: {
    imagePreview?: {
      data?: {
        sources?: SpotifyImageSource[];
      };
    };
  };
};

type SpotifyInitialState = {
  entities?: {
    items?: Record<
      string,
      {
        pages?: {
          items?: Array<{
            entity?: {
              data?: SpotifyEpisodeData;
            };
          }>;
        };
      }
    >;
  };
};

type ScheduleEpisode = {
  coverUrl: string;
  description: string;
  durationLabel: string;
  id: string;
  mediaTypes: string[];
  mediaUrl: string;
  releaseDate: string;
  title: string;
  url: string;
  watchUrl: string;
};

const spotifyShowId = "00yWnJPE80LSBglGwCrjZI";
const spotifyShowUrl = `https://open.spotify.com/show/${spotifyShowId}`;
const showImageUrl = "https://i.scdn.co/image/ab6765630000ba8a62b9cfd238cc2f94cfaa2612";
const marketBubbleLogoUrl = "/market-bubble-logo.svg";
const fallbackWatchUrl = "https://www.twitch.tv/fazebanks/videos";
const hostProfiles = [
  {
    handle: "Banks",
    imageUrl: "https://pbs.twimg.com/profile_images/2032366445129244672/vwIeIXRn_400x400.jpg",
    name: "Banks",
  },
  {
    handle: "blknoiz06",
    imageUrl: "https://pbs.twimg.com/profile_images/2052070109758226438/xlyPdLmn_400x400.jpg",
    name: "Ansem",
  },
] as const;
const episodeWatchUrlsBySpotifyId: Record<string, string> = {
  "0xagf4GYhZvafuupXqFOsM": "https://www.twitch.tv/videos/2760932521",
  "3hyI8cceqmXjns3j87cOio": "https://www.twitch.tv/videos/2777595863",
  "3tb6qC1wYJ8NzmetLkRHAH": "https://www.twitch.tv/videos/2788673017",
  "6FtrBE4TIp3pYip1hHo3XP": "https://www.twitch.tv/videos/2766528096",
  "7G0I5apOeMkc7oHepmUj6I": "https://www.twitch.tv/videos/2772016731",
};

const fallbackEpisodes: ScheduleEpisode[] = [
  {
    coverUrl: showImageUrl,
    description:
      "Banks and Ansem reason through Bitcoin, Hyperliquid, stablecoins, crypto rails, and the future of money.",
    durationLabel: "4h 42m",
    id: "3tb6qC1wYJ8NzmetLkRHAH",
    mediaTypes: ["VIDEO", "AUDIO"],
    mediaUrl: "https://image-cdn-ak.spotifycdn.com/image/ab6772ab00001692a88ec923600251a79335e09e",
    releaseDate: "Jun 5, 2026",
    title: "The Dollar Is Going to Zero",
    url: "https://open.spotify.com/episode/3tb6qC1wYJ8NzmetLkRHAH",
    watchUrl: episodeWatchUrlsBySpotifyId["3tb6qC1wYJ8NzmetLkRHAH"],
  },
  {
    coverUrl: "https://i.scdn.co/image/ab6765630000ba8aa906096f1393180f9f4a65d9",
    description:
      "Ansem and Banks break down recent market picks, Akash, AI infrastructure, crypto rotation, and internet-native investing.",
    durationLabel: "2h 54m",
    id: "3hyI8cceqmXjns3j87cOio",
    mediaTypes: ["VIDEO", "AUDIO"],
    mediaUrl: "https://image-cdn-ak.spotifycdn.com/image/ab6772ab00001692c64a334bcfdbbe4e91ee79d1",
    releaseDate: "May 22, 2026",
    title: "Why Ansem Thinks Ethereum Is Done..",
    url: "https://open.spotify.com/episode/3hyI8cceqmXjns3j87cOio",
    watchUrl: episodeWatchUrlsBySpotifyId["3hyI8cceqmXjns3j87cOio"],
  },
  {
    coverUrl: showImageUrl,
    description:
      "Banks, Ansem, TJR, Tristan Thompson, and Mizkif talk AI, crypto, investing, and the attention economy.",
    durationLabel: "3h 33m",
    id: "7G0I5apOeMkc7oHepmUj6I",
    mediaTypes: ["VIDEO", "AUDIO"],
    mediaUrl: "https://image-cdn-ak.spotifycdn.com/image/ab6772ab000016928e23726d9a0a9ea2d053fdad",
    releaseDate: "May 15, 2026",
    title: "How to Get Rich Playing GTA 6",
    url: "https://open.spotify.com/episode/7G0I5apOeMkc7oHepmUj6I",
    watchUrl: episodeWatchUrlsBySpotifyId["7G0I5apOeMkc7oHepmUj6I"],
  },
  {
    coverUrl: showImageUrl,
    description:
      "Ansem and Banks host conversations with Mizkif and NotSoEasyMoney about AI, livestreaming, trading, and market narratives.",
    durationLabel: "3h 45m",
    id: "6FtrBE4TIp3pYip1hHo3XP",
    mediaTypes: ["VIDEO", "AUDIO"],
    mediaUrl: "https://image-cdn-ak.spotifycdn.com/image/ab6772ab000016925364ed6046997b1173484e8e",
    releaseDate: "May 8, 2026",
    title: "Why AI Is Beating Crypto Right Now",
    url: "https://open.spotify.com/episode/6FtrBE4TIp3pYip1hHo3XP",
    watchUrl: episodeWatchUrlsBySpotifyId["6FtrBE4TIp3pYip1hHo3XP"],
  },
  {
    coverUrl: "https://i.scdn.co/image/ab6765630000ba8a00cf51b4a573898a7e6ee5d8",
    description:
      "Banks sits down with Ansem for a conversation on crypto, AI, internet culture, and the future of attention online.",
    durationLabel: "1h 7m",
    id: "0xagf4GYhZvafuupXqFOsM",
    mediaTypes: ["VIDEO", "AUDIO"],
    mediaUrl: "https://image-cdn-fa.spotifycdn.com/image/ab6772ab00001692b630c5e9c08163bac4579c62",
    releaseDate: "May 1, 2026",
    title: "The Truth About Crypto in 2026",
    url: "https://open.spotify.com/episode/0xagf4GYhZvafuupXqFOsM",
    watchUrl: episodeWatchUrlsBySpotifyId["0xagf4GYhZvafuupXqFOsM"],
  },
];

function getLargestImage(sources: SpotifyImageSource[] | undefined) {
  if (!sources?.length) {
    return "";
  }

  const sortedSources = [...sources].sort((a, b) => {
    const aSize = (a.width ?? a.maxWidth ?? 0) * (a.height ?? a.maxHeight ?? 0);
    const bSize = (b.width ?? b.maxWidth ?? 0) * (b.height ?? b.maxHeight ?? 0);

    return aSize - bSize;
  });

  return sortedSources.at(-1)?.url ?? "";
}

function safeExternalUrl(value: string | undefined, fallback = "") {
  if (!value) {
    return fallback;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function cleanText(value: string | undefined) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function formatDate(value: string | undefined) {
  const timestamp = value ? Date.parse(value) : NaN;

  if (!Number.isFinite(timestamp)) {
    return "Latest";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatDuration(milliseconds: number | undefined) {
  if (!Number.isFinite(milliseconds) || !milliseconds) {
    return "Runtime TBA";
  }

  const totalMinutes = Math.max(1, Math.round(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function normalizeEpisode(episode: SpotifyEpisodeData): ScheduleEpisode | null {
  const id = cleanText(episode.id);
  const title = cleanText(episode.name);

  if (!id || !title) {
    return null;
  }

  const coverUrl = safeExternalUrl(getLargestImage(episode.coverArt?.sources), showImageUrl);
  const thumbnailUrl = safeExternalUrl(
    getLargestImage(episode.videoPreviewThumbnail?.imagePreview?.data?.sources),
    coverUrl,
  );

  return {
    coverUrl,
    description: cleanText(episode.description),
    durationLabel: formatDuration(episode.duration?.totalMilliseconds),
    id,
    mediaTypes: episode.mediaTypes ?? [],
    mediaUrl: thumbnailUrl,
    releaseDate: formatDate(episode.releaseDate?.isoString),
    title,
    url: `https://open.spotify.com/episode/${encodeURIComponent(id)}`,
    watchUrl: episodeWatchUrlsBySpotifyId[id] ?? fallbackWatchUrl,
  };
}

async function fetchSpotifyEpisodes() {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 9000);

  try {
    const response = await fetch(`${spotifyShowUrl}?nd=1`, {
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml,*/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      return fallbackEpisodes;
    }

    const html = await response.text();
    const initialState = html.match(/<script id="initialState" type="text\/plain">([\s\S]*?)<\/script>/)?.[1];

    if (!initialState) {
      return fallbackEpisodes;
    }

    const parsedState = JSON.parse(Buffer.from(initialState, "base64").toString("utf8")) as SpotifyInitialState;
    const items = parsedState.entities?.items?.[`spotify:show:${spotifyShowId}`]?.pages?.items ?? [];
    const episodes = items
      .map((item) => (item.entity?.data ? normalizeEpisode(item.entity.data) : null))
      .filter((episode): episode is ScheduleEpisode => Boolean(episode));

    return episodes.length ? episodes : fallbackEpisodes;
  } catch {
    return fallbackEpisodes;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function SchedulePage() {
  const episodes = await fetchSpotifyEpisodes();

  return (
    <main
      aria-label="Market Bubble schedule"
      className={`site-shell ${styles.scheduleSiteShell} relative min-h-dvh overflow-hidden bg-background`}
    >
      <TopTextNav current="schedule" />
      <section className={styles.schedulePage} aria-label="Market Bubble show schedule">
        <section className={styles.episodesPanel} aria-label="Spotify episodes">
          <div className={styles.scheduleSummary}>
            <span>LIVE &bull; THURDSAYS &bull; 1PM PST</span>
            <ScheduleCountdown />
          </div>
          <div className={styles.episodeGrid}>
            {episodes.map((episode) => (
              <article className={styles.episodeCard} key={episode.id}>
                <header className={styles.cardHeader}>
                  <Image alt="" height={40} src={marketBubbleLogoUrl} width={40} />
                  <div>
                    <strong>Market Bubble</strong>
                    <span>{episode.releaseDate}</span>
                  </div>
                </header>
                <a className={styles.cardMedia} href={episode.url} rel="noreferrer" target="_blank">
                  <Image
                    alt=""
                    fill
                    sizes="(max-width: 680px) 100vw, (max-width: 1080px) 50vw, 33vw"
                    src={episode.mediaUrl}
                  />
                </a>
                <div className={styles.cardBody}>
                  <h3>{episode.title}</h3>
                  <p>{episode.description}</p>
                </div>
                <footer className={styles.cardFooter}>
                  <div className={styles.hostStack} aria-hidden="true">
                    {hostProfiles.map((host) => (
                      <Image alt={host.name} height={32} key={host.handle} src={host.imageUrl} width={32} />
                    ))}
                  </div>
                  <div className={styles.cardMeta}>
                    <span>{episode.durationLabel}</span>
                    <span>{episode.mediaTypes.includes("VIDEO") ? "Video" : "Audio"}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <a href={episode.url} rel="noreferrer" target="_blank">
                      Listen
                    </a>
                    <a href={episode.watchUrl} rel="noreferrer" target="_blank">
                      Watch Video
                    </a>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
