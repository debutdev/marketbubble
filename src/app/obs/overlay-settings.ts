import type { Platform } from "@/components/AggregatedChat";

export type OverlayKind = "chat" | "news" | "polymarket";

export type OverlaySearchParams = Record<string, string | string[] | undefined>;

export type OverlaySettings = {
  framed: boolean;
  limit: number;
  mock: boolean;
  platforms: Platform[];
  source: string;
};

const allPlatforms: Platform[] = ["Twitch", "Kick", "X"];

const defaultSettingsByKind: Record<OverlayKind, OverlaySettings> = {
  chat: {
    framed: false,
    limit: 28,
    mock: false,
    platforms: allPlatforms,
    source: "both",
  },
  news: {
    framed: true,
    limit: 8,
    mock: false,
    platforms: allPlatforms,
    source: "both",
  },
  polymarket: {
    framed: true,
    limit: 6,
    mock: false,
    platforms: allPlatforms,
    source: "both",
  },
};

function getSearchValue(
  searchParams: OverlaySearchParams | undefined,
  key: string,
) {
  const value = searchParams?.[key];

  return Array.isArray(value) ? value[0] : value;
}

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function normalizeLimit(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(parsed, 80));
}

function normalizePlatforms(value: string | undefined) {
  if (!value) {
    return allPlatforms;
  }

  const requestedPlatforms = new Set(
    value
      .split(",")
      .map((platform) => platform.trim().toLowerCase())
      .filter(Boolean),
  );

  const platforms = allPlatforms.filter((platform) =>
    requestedPlatforms.has(platform.toLowerCase()),
  );

  return platforms.length > 0 ? platforms : allPlatforms;
}

export function getOverlaySettings(
  kind: OverlayKind,
  searchParams?: OverlaySearchParams,
): OverlaySettings {
  const defaults = defaultSettingsByKind[kind];

  return {
    framed: normalizeBoolean(getSearchValue(searchParams, "framed"), defaults.framed),
    limit: normalizeLimit(getSearchValue(searchParams, "limit"), defaults.limit),
    mock: normalizeBoolean(getSearchValue(searchParams, "mock"), defaults.mock),
    platforms: normalizePlatforms(getSearchValue(searchParams, "platforms")),
    source: getSearchValue(searchParams, "source") ?? defaults.source,
  };
}
