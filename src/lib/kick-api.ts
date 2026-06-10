const kickApiBaseUrl = "https://api.kick.com";
const kickTokenUrl = "https://id.kick.com/oauth/token";

type KickTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type KickTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

export type KickChannel = {
  active_subscribers_count?: number;
  banner_picture?: string;
  broadcaster_user_id?: number;
  canceled_subscribers_count?: number;
  category?: {
    id?: number;
    name?: string;
    thumbnail?: string;
  };
  channel_description?: string;
  slug?: string;
  stream?: {
    custom_tags?: string[];
    is_live?: boolean;
    is_mature?: boolean;
    language?: string;
    start_time?: string;
    thumbnail?: string;
    viewer_count?: number;
  };
  stream_title?: string;
};

export type KickLivestream = {
  broadcaster_user_id?: number;
  category?: {
    id?: number;
    name?: string;
    thumbnail?: string;
  };
  channel_id?: number;
  custom_tags?: string[];
  has_mature_content?: boolean;
  language?: string;
  profile_picture?: string;
  slug?: string;
  started_at?: string;
  stream_title?: string;
  thumbnail?: string;
  viewer_count?: number;
};

let kickTokenCache: KickTokenCache | null = null;

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function getKickClientId() {
  return cleanEnvValue(process.env.KICK_CLIENT_ID);
}

function getKickClientSecret() {
  return cleanEnvValue(process.env.KICK_CLIENT_SECRET);
}

function getStaticKickToken() {
  return cleanEnvValue(process.env.KICK_APP_ACCESS_TOKEN);
}

export function hasKickApiCredentials() {
  return Boolean(getStaticKickToken() || (getKickClientId() && getKickClientSecret()));
}

async function getKickAccessToken() {
  const staticToken = getStaticKickToken();

  if (staticToken) {
    return staticToken;
  }

  const clientId = getKickClientId();
  const clientSecret = getKickClientSecret();

  if (!clientId || !clientSecret) {
    return null;
  }

  if (kickTokenCache && kickTokenCache.expiresAt > Date.now() + 60_000) {
    return kickTokenCache.accessToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const response = await fetch(kickTokenUrl, {
    body,
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as KickTokenResponse;

  if (!data.access_token) {
    return null;
  }

  kickTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(0, Number(data.expires_in ?? 0) - 60) * 1000,
  };

  return data.access_token;
}

async function kickFetch<T>(path: string, params?: URLSearchParams) {
  const accessToken = await getKickAccessToken();

  if (!accessToken) {
    return null;
  }

  const url = new URL(path, kickApiBaseUrl);

  if (params) {
    params.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function getKickChannelsBySlug(slugs: string[]) {
  if (!hasKickApiCredentials() || slugs.length === 0) {
    return null;
  }

  const params = new URLSearchParams();

  for (const slug of slugs.slice(0, 50)) {
    params.append("slug", slug);
  }

  const data = await kickFetch<{ data?: KickChannel[] }>("/public/v1/channels", params);

  if (!data) {
    return null;
  }

  return Object.fromEntries(
    (data.data ?? [])
      .filter((channel) => channel.slug)
      .map((channel) => [String(channel.slug).toLowerCase(), channel]),
  ) as Record<string, KickChannel>;
}

export async function getKickLivestreamsByBroadcasterId(broadcasterUserIds: number[]) {
  const ids = broadcasterUserIds.filter((id) => Number.isFinite(id) && id > 0).slice(0, 50);

  if (!hasKickApiCredentials() || ids.length === 0) {
    return null;
  }

  const params = new URLSearchParams({
    limit: String(ids.length),
    sort: "viewer_count",
  });

  for (const id of ids) {
    params.append("broadcaster_user_id", String(id));
  }

  const data = await kickFetch<{ data?: KickLivestream[] }>("/public/v1/livestreams", params);

  if (!data) {
    return null;
  }

  return Object.fromEntries(
    (data.data ?? [])
      .filter((stream) => stream.broadcaster_user_id)
      .map((stream) => [String(stream.broadcaster_user_id), stream]),
  ) as Record<string, KickLivestream>;
}
